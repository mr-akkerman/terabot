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
    this.log('Restarting campaign, clearing previous progress...');
    await campaignRecipientStore.clearForCampaign(this.options.campaign.id);
    // Reset progress object
    this.progress = {
        campaignId: this.options.campaign.id,
        totalUsers: 0,
        sentCount: 0,
        failedCount: 0,
        results: [],
    };
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
        
        this.log('Loading user base...');
        const loader = new UserBaseLoader(this.options.userBase, (s, m) => this.log(`[UserLoader:${s}] ${m}`));
        const allUserIds = await loader.loadUserIds();
        
        this.log('Checking for existing progress in DB...');
        const processedUsers = await campaignRecipientStore.getUnprocessed(this.options.campaign.id);
        const processedUserIds = new Set(processedUsers.map(u => u.userId));
        
        this.userIdsToProcess = allUserIds.filter(id => !processedUserIds.has(id));
        this.progress.totalUsers = allUserIds.length;
        this.progress.sentCount = processedUsers.filter(u => u.status === 'success').length;
        this.progress.failedCount = processedUsers.filter(u => u.status === 'failed').length;

        if (this.userIdsToProcess.length === 0) {
            this.log('No new users to process. Campaign is considered complete.');
            this.status = 'completed';
            this.options.onFinish(this.status, this.progress);
            return;
        }

        this.log(`Found ${this.userIdsToProcess.length} users to process. Adding to DB queue...`);
        const recipientsToQueue = this.userIdsToProcess.map(userId => ({ campaignId: this.options.campaign.id, userId, status: 'pending' as const }));
        await campaignRecipientStore.bulkAdd(recipientsToQueue);

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
        this.limiter.stop();
        // Call onFinish immediately to finalize the state.
        this.options.onFinish(this.status, this.progress);
    }
  }

  private async runLoop() {
    this.log(`Starting run loop with ${this.userIdsToProcess.length} users.`);
    
    for (let i = 0; i < this.userIdsToProcess.length; i += CHUNK_SIZE) {
        if (this.status !== 'running') {
            this.log(`Loop halted. Status: ${this.status}`);
            // For pause/stop, we just exit the loop. 
            // The state is handled by the pause() and stop() methods.
            return;
        }
        
        const chunk = this.userIdsToProcess.slice(i, i + CHUNK_SIZE);
        this.log(`Processing chunk of ${chunk.length} users (offset: ${i}).`);

        const promises = chunk.map(userId => {
            const { method, payload } = this.prepareMessagePayload(userId);
            return this.limiter.enqueue(method, payload)
                .then(() => {
                    this.progress.sentCount++;
                    return campaignRecipientStore.updateStatus(this.options.campaign.id, userId, 'success');
                })
                .catch((error) => {
                    this.progress.failedCount++;
                    const errorMsg = error instanceof TelegramApiError ? error.description : error.message;
                    this.log(`Failed to send to ${userId}: ${errorMsg}`);
                    return campaignRecipientStore.updateStatus(this.options.campaign.id, userId, 'failed', errorMsg);
                })
                .finally(() => {
                    this.options.onProgress(this.progress);
                });
        });

        await Promise.allSettled(promises);
    }

    // This code only runs if the loop completes without being interrupted.
    if (this.status === 'running') {
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