import type { Campaign, UserBase, Bot, CampaignProgress } from '@/types';
import { TelegramAPI, TelegramApiError } from '@/utils/telegram';
import { TelegramLimiter } from './telegram-limiter';
import { UserBaseLoader } from './user-base-loader';
import { campaignRecipientStore } from './db';

const CHUNK_SIZE = 100;

type RunnerStatus = 'idle' | 'loading-users' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';

interface CampaignRunnerOptions {
  campaign: Campaign;
  userBase: UserBase;
  bot: Bot;
  onProgress: (progress: CampaignProgress) => void;
  onFinish: (status: RunnerStatus, finalProgress: CampaignProgress) => void;
  onError: (error: Error, finalProgress: CampaignProgress) => void;
}

export class CampaignRunner {
  private status: RunnerStatus = 'idle';
  private progress: CampaignProgress;
  
  private readonly api: TelegramAPI;
  private readonly limiter: TelegramLimiter;
  private userIdsToProcess: number[] = [];
  private shouldStop = false; // Флаг для контроля выполнения промисов

  constructor(private readonly options: CampaignRunnerOptions) {
    this.api = new TelegramAPI(options.bot.token, { logger: console.log });
    this.limiter = new TelegramLimiter(this.api);
    
    this.progress = options.campaign.progress || {
        campaignId: options.campaign.id,
        totalUsers: 0,
        sentCount: 0,
        failedCount: 0,
        results: [],
    };
  }

  public getStatus(): RunnerStatus {
    return this.status;
  }
  
  /**
   * Starts the campaign from the beginning, clearing any previous progress.
   */
  public async restart() {
    this.log('Restarting campaign...');
    // The service layer is now responsible for clearing old data.
    // The runner just needs to (re)start the process.
    await this.start();
  }

  /**
   * Starts a campaign, resuming from its last known state.
   */
  public async start() {
    if (this.status === 'running' || this.status === 'loading-users') return;
    this.log('Starting or resuming campaign...');
    
    try {
        this.status = 'loading-users';
        this.shouldStop = false; // Сбрасываем флаг остановки
        
        this.log('Loading user base...');
        const loader = new UserBaseLoader(this.options.userBase, (s, m) => this.log(`[UserLoader:${s}] ${m}`));
        const allUserIds = await loader.loadUserIds();
        
        this.log('Checking for existing progress in DB...');
        // Используем новый метод для получения только обработанных пользователей
        const processedUserIds = await campaignRecipientStore.getProcessedUserIds(this.options.campaign.id);
        const processedSet = new Set(processedUserIds);
        
        // Получаем статистику для обновления прогресса
        const stats = await campaignRecipientStore.getCampaignStats(this.options.campaign.id);
        
        this.userIdsToProcess = allUserIds.filter(id => !processedSet.has(id));
        this.progress.totalUsers = allUserIds.length;
        this.progress.sentCount = stats.success;
        this.progress.failedCount = stats.failed;

        this.log(`Campaign stats: Total: ${allUserIds.length}, Processed: ${processedUserIds.length} (Success: ${stats.success}, Failed: ${stats.failed}), Pending: ${stats.pending}, To Process: ${this.userIdsToProcess.length}`);

        if (this.userIdsToProcess.length === 0) {
            this.log('No new users to process. Campaign is considered complete.');
            this.status = 'completed';
            this.options.onFinish(this.status, this.progress);
            return;
        }

        // Добавляем в БД только новых пользователей (тех, кого нет в processedSet и нет в pending)
        const pendingRecipients = await campaignRecipientStore.getPendingRecipients(this.options.campaign.id);
        const pendingSet = new Set(pendingRecipients.map(r => r.userId));
        
        const newUsersToQueue = this.userIdsToProcess.filter(id => !pendingSet.has(id));
        
        if (newUsersToQueue.length > 0) {
            this.log(`Found ${newUsersToQueue.length} new users to add to DB queue...`);
            const recipientsToQueue = newUsersToQueue.map(userId => ({ 
                campaignId: this.options.campaign.id, 
                userId, 
                status: 'pending' as const 
            }));
            await campaignRecipientStore.bulkAdd(recipientsToQueue);
        } else {
            this.log('All users are already in the queue, resuming from existing progress...');
        }

        this.log('Starting distribution...');
        this.status = 'running';
        this.limiter.start();
        this.runLoop();

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.log(`Failed to start campaign: ${message}`);
        this.status = 'failed';
        this.options.onError(error as Error, this.progress);
    }
  }

  /**
   * Pauses the currently running campaign.
   */
  public pause() {
    if (this.status === 'running') {
      this.log('Pausing campaign...');
      this.status = 'paused';
      this.shouldStop = true; // Устанавливаем флаг для остановки новых запросов
      this.limiter.stop();
    }
  }

  /**
   * Stops the campaign permanently, saving final progress.
   */
  public stop() {
    if (this.status === 'running' || this.status === 'paused') {
        this.log('Stopping campaign...');
        this.status = 'stopped';
        this.shouldStop = true; // Устанавливаем флаг для остановки новых запросов
        this.limiter.stop();
        // Call onFinish immediately to finalize the state.
        this.options.onFinish(this.status, this.progress);
    }
  }

  private async runLoop() {
    this.log(`Starting run loop with ${this.userIdsToProcess.length} users.`);
    
    for (let i = 0; i < this.userIdsToProcess.length; i += CHUNK_SIZE) {
        if (this.status !== 'running' || this.shouldStop) {
            this.log(`Loop halted. Status: ${this.status}, shouldStop: ${this.shouldStop}`);
            // For pause/stop, we just exit the loop. 
            // The state is handled by the pause() and stop() methods.
            return;
        }
        
        const chunk = this.userIdsToProcess.slice(i, i + CHUNK_SIZE);
        this.log(`Processing chunk of ${chunk.length} users (offset: ${i}).`);

        const promises = chunk.map(userId => {
            // Проверяем флаг остановки перед каждым запросом
            if (this.shouldStop) {
                this.log(`Skipping user ${userId} due to stop flag`);
                return Promise.resolve();
            }

            const { method, payload } = this.prepareMessagePayload(userId);
            return this.limiter.enqueue(method, payload)
                .then(() => {
                    // Проверяем флаг остановки перед обновлением статуса
                    if (this.shouldStop) {
                        this.log(`Skipping status update for user ${userId} due to stop flag`);
                        return;
                    }
                    this.progress.sentCount++;
                    return campaignRecipientStore.updateStatus(this.options.campaign.id, userId, 'success');
                })
                .catch((error) => {
                    // Проверяем флаг остановки перед обновлением статуса
                    if (this.shouldStop) {
                        this.log(`Skipping error status update for user ${userId} due to stop flag`);
                        return;
                    }
                    this.progress.failedCount++;
                    const errorMsg = error instanceof TelegramApiError ? error.description : error.message;
                    this.log(`Failed to send to ${userId}: ${errorMsg}`);
                    return campaignRecipientStore.updateStatus(this.options.campaign.id, userId, 'failed', errorMsg);
                })
                .finally(() => {
                    // Только обновляем прогресс, если не остановлены
                    if (!this.shouldStop) {
                        this.options.onProgress(this.progress);
                    }
                });
        });

        await Promise.allSettled(promises);
        
        // Дополнительная проверка после обработки чанка
        if (this.status !== 'running' || this.shouldStop) {
            this.log(`Stopping after chunk processing. Status: ${this.status}, shouldStop: ${this.shouldStop}`);
            return;
        }
    }

    // This code only runs if the loop completes without being interrupted.
    if (this.status === 'running' && !this.shouldStop) {
        this.log('Campaign completed.');
        this.status = 'completed';
        this.limiter.stop();
        this.options.onFinish(this.status, this.progress);
    }
  }

  private prepareMessagePayload(userId: number) {
    const { campaign } = this.options;
    const { message } = campaign;

    const commonPayload = {
        chat_id: userId,
        parse_mode: message.parse_mode,
        reply_markup: message.buttons && message.buttons.length > 0
            ? { inline_keyboard: message.buttons }
            : undefined,
    };

    if (message.photo) {
        const payload = {
            ...commonPayload,
            photo: message.photo,
            caption: message.text,
        };
        return { method: 'sendPhoto' as const, payload };
    } else {
        const payload = {
            ...commonPayload,
            text: message.text,
        };
        return { method: 'sendMessage' as const, payload };
    }
  }

  private log(message: string) {
    console.log(`[CampaignRunner:${this.options.campaign.id}] ${message}`);
  }
} 