import type { Campaign, UserBase, Bot, CampaignProgress, CampaignPartProgress } from '@/types';
import { TelegramAPI, TelegramApiError } from '@/utils/telegram';
import { TelegramLimiter, LimiterStoppedError } from './telegram-limiter';
import { UserBaseLoader } from './user-base-loader';
import { campaignRecipientStore } from './db';

const CHUNK_SIZE = 100;

type RunnerStatus = 'idle' | 'loading-users' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';

interface CampaignRunnerOptions {
  campaign: Campaign;
  /** Базы в порядке рассылки: одна обычная база или все части группы. */
  userBases: UserBase[];
  bot: Bot;
  onProgress: (progress: CampaignProgress) => void;
  /** Часть группы разослана целиком — прогресс нужно сразу сохранить. */
  onPartComplete?: (progress: CampaignProgress) => void | Promise<void>;
  onFinish: (status: RunnerStatus, finalProgress: CampaignProgress) => void;
  onError: (error: Error, finalProgress: CampaignProgress) => void;
}

/** Часть рассылки: база и её получатели (без тех, кто уже есть в предыдущих частях). */
interface PartPlan {
  userBase: UserBase;
  userIds: number[];
}

export class CampaignRunner {
  private status: RunnerStatus = 'idle';
  private progress: CampaignProgress;
  
  private readonly api: TelegramAPI;
  private readonly limiter: TelegramLimiter;
  private shouldStop = false; // Флаг для контроля выполнения промисов
  // Номер запуска: цикл рассылки, оставшийся от запуска до паузы, не должен
  // продолжить работу параллельно с новым после быстрого resume.
  private generation = 0;

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
   * Базы рассылаются строго по очереди: следующая часть начинается только после
   * того, как предыдущая разослана целиком и её прогресс сохранён.
   */
  public async start() {
    if (this.status === 'running' || this.status === 'loading-users') return;
    this.log('Starting or resuming campaign...');
    const generation = ++this.generation;
    const campaignId = this.options.campaign.id;
    
    try {
        this.status = 'loading-users';
        this.shouldStop = false; // Сбрасываем флаг остановки
        
        this.log(`Loading ${this.options.userBases.length} user base(s)...`);
        // Получатель, попавший в несколько частей, остаётся только в первой из них.
        const seen = new Set<number>();
        const plan: PartPlan[] = [];
        for (const userBase of this.options.userBases) {
            const loader = new UserBaseLoader(userBase, (s, m) => this.log(`[UserLoader:${userBase.name}:${s}] ${m}`));
            const userIds = (await loader.loadUserIds()).filter(id => !seen.has(id));
            userIds.forEach(id => seen.add(id));
            plan.push({ userBase, userIds });
        }
        
        this.log('Checking for existing progress in DB...');
        const processedSet = new Set(await campaignRecipientStore.getProcessedUserIds(campaignId));
        const stats = await campaignRecipientStore.getCampaignStats(campaignId);
        const pendingRecipients = await campaignRecipientStore.getPendingRecipients(campaignId);
        const pendingSet = new Set(pendingRecipients.map(r => r.userId));
        if (generation !== this.generation || this.shouldStop) return;
        
        this.progress.totalUsers = seen.size;
        this.progress.sentCount = stats.success;
        this.progress.failedCount = stats.failed;
        if (this.options.campaign.userBaseGroupId) {
            this.progress.parts = plan.map(({ userBase, userIds }) => {
                const processedCount = userIds.reduce((n, id) => n + (processedSet.has(id) ? 1 : 0), 0);
                return {
                    userBaseId: userBase.id,
                    name: userBase.name,
                    totalUsers: userIds.length,
                    processedCount,
                    status: processedCount >= userIds.length ? 'completed' as const : 'pending' as const,
                };
            });
        } else {
            delete this.progress.parts;
        }

        const leftToProcess = plan.reduce((n, part) => n + part.userIds.filter(id => !processedSet.has(id)).length, 0);
        this.log(`Campaign stats: Total: ${seen.size}, Success: ${stats.success}, Failed: ${stats.failed}, Pending: ${stats.pending}, To Process: ${leftToProcess}`);

        if (leftToProcess === 0) {
            this.log('No new users to process. Campaign is considered complete.');
            this.status = 'completed';
            this.options.onFinish(this.status, this.progress);
            return;
        }

        this.log('Starting distribution...');
        this.status = 'running';
        this.limiter.start();
        this.options.onProgress(this.progress);
        void this.runParts(plan, processedSet, pendingSet, generation).catch((error) => {
            if (generation !== this.generation) return;
            this.fail(error);
        });

    } catch (error) {
        if (generation !== this.generation) return;
        this.fail(error);
    }
  }

  private fail(error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.log(`Campaign failed: ${message}`);
    this.status = 'failed';
    this.shouldStop = true;
    this.limiter.stop();
    this.options.onError(error as Error, this.progress);
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

  /** Запуск всё ещё актуален и не поставлен на паузу/остановлен. */
  private isActive(generation: number) {
    return generation === this.generation && this.status === 'running' && !this.shouldStop;
  }

  private async runParts(plan: PartPlan[], processedSet: Set<number>, pendingSet: Set<number>, generation: number) {
    const campaignId = this.options.campaign.id;

    for (let partIndex = 0; partIndex < plan.length; partIndex++) {
        if (!this.isActive(generation)) return;

        const { userBase, userIds } = plan[partIndex];
        const partProgress = this.progress.parts?.[partIndex];
        const toProcess = userIds.filter(id => !processedSet.has(id));

        if (toProcess.length === 0) {
            this.log(`Part ${partIndex + 1}/${plan.length} "${userBase.name}" is already sent, skipping.`);
            if (partProgress) partProgress.status = 'completed';
            continue;
        }

        this.log(`Part ${partIndex + 1}/${plan.length} "${userBase.name}": ${toProcess.length} users to process.`);
        if (partProgress) partProgress.status = 'running';

        // В очередь в БД попадают только получатели текущей части.
        const newUsersToQueue = toProcess.filter(id => !pendingSet.has(id));
        if (newUsersToQueue.length > 0) {
            await campaignRecipientStore.bulkAdd(
                newUsersToQueue.map(userId => ({ campaignId, userId, status: 'pending' as const })),
            );
        }
        if (!this.isActive(generation)) return;
        this.options.onProgress(this.progress);

        const finished = await this.sendUsers(toProcess, partProgress, generation);
        if (!finished) return;

        if (partProgress) partProgress.status = 'completed';
        this.log(`Part ${partIndex + 1}/${plan.length} "${userBase.name}" completed, saving progress.`);
        // Прогресс части сохраняем до того, как начнётся следующая.
        await this.options.onPartComplete?.(this.progress);
    }

    // This code only runs if every part completes without being interrupted.
    if (this.isActive(generation)) {
        this.log('Campaign completed.');
        this.status = 'completed';
        this.limiter.stop();
        this.options.onFinish(this.status, this.progress);
    }
  }

  /** Рассылает список получателей. Возвращает false, если рассылку прервали. */
  private async sendUsers(userIds: number[], partProgress: CampaignPartProgress | undefined, generation: number): Promise<boolean> {
    const campaignId = this.options.campaign.id;

    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
        if (!this.isActive(generation)) {
            this.log(`Loop halted. Status: ${this.status}, shouldStop: ${this.shouldStop}`);
            // For pause/stop, we just exit the loop. 
            // The state is handled by the pause() and stop() methods.
            return false;
        }
        
        const chunk = userIds.slice(i, i + CHUNK_SIZE);
        this.log(`Processing chunk of ${chunk.length} users (offset: ${i}).`);

        const promises = chunk.map(userId => {
            // Проверяем флаг остановки перед каждым запросом
            if (this.shouldStop) {
                this.log(`Skipping user ${userId} due to stop flag`);
                return Promise.resolve();
            }

            const { method, payload } = this.prepareMessagePayload(userId);
            // Результат пишем всегда, когда запрос реально дошёл до Telegram — даже если
            // кампанию уже поставили на паузу, иначе при возобновлении человек получит дубль.
            // В pending остаются только те, кого лимитер не успел отправить (LimiterStoppedError).
            return this.limiter.enqueue(method, payload)
                .then(() => {
                    this.progress.sentCount++;
                    if (partProgress) partProgress.processedCount++;
                    return campaignRecipientStore.updateStatus(campaignId, userId, 'success');
                })
                .catch((error) => {
                    if (error instanceof LimiterStoppedError) return;
                    this.progress.failedCount++;
                    if (partProgress) partProgress.processedCount++;
                    const errorMsg = error instanceof TelegramApiError ? error.description : error.message;
                    this.log(`Failed to send to ${userId}: ${errorMsg}`);
                    return campaignRecipientStore.updateStatus(campaignId, userId, 'failed', errorMsg);
                })
                .finally(() => {
                    // Только обновляем прогресс, если не остановлены
                    if (!this.shouldStop) {
                        this.options.onProgress(this.progress);
                    }
                });
        });

        await Promise.allSettled(promises);
    }

    return this.isActive(generation);
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