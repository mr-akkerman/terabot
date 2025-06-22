import type { Campaign, UserBase, Bot, CampaignProgress } from '@/types';
import { TelegramAPI, TelegramApiError } from '@/utils/telegram';
import { TelegramLimiter } from './telegram-limiter';
import { UserBaseLoader } from './user-base-loader';

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
  private userIds: number[] = [];

  constructor(private readonly options: CampaignRunnerOptions) {
    this.api = new TelegramAPI(options.bot.token, { logger: console.log });
    this.limiter = new TelegramLimiter(this.api);
    
    this.progress = options.campaign.progress || {
        campaignId: options.campaign.id,
        totalUsers: 0, // Will be updated after loading users
        sentCount: 0,
        failedCount: 0,
        results: [],
    };
  }

  public getStatus(): RunnerStatus {
    return this.status;
  }
  
  public async start() {
    if (this.status === 'running' || this.status === 'loading-users') return;
    this.log('Starting campaign...');
    
    try {
        this.status = 'loading-users';
        this.log('Loading user base...');
        const loader = new UserBaseLoader(this.options.userBase, (status, message) => {
            this.log(`[UserLoader:${status}] ${message}`);
        });
        this.userIds = await loader.loadUserIds();
        this.progress.totalUsers = this.userIds.length;

        if (this.userIds.length === 0) {
            this.log('User base is empty. Stopping campaign.');
            this.status = 'completed'; // Or 'failed' with a specific message
            this.options.onFinish(this.status, this.progress);
            return;
        }

        this.log(`Successfully loaded ${this.userIds.length} users. Starting distribution.`);
        this.status = 'running';
        this.limiter.start();
        this.runLoop();

    } catch (error) {
        this.log(`Failed to load user base: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.status = 'failed';
        this.options.onError(error as Error, this.progress);
    }
  }

  public pause() {
    if (this.status === 'running') {
      this.log('Pausing campaign...');
      this.status = 'paused';
      this.limiter.stop();
    }
  }

  public stop() {
    this.log('Stopping campaign...');
    this.status = 'stopped';
    this.limiter.stop();
  }

  private async runLoop() {
    this.log(`Enqueuing ${this.userIds.length} messages.`);

    const promises = this.userIds.map(userId => {
        const { method, payload } = this.prepareMessagePayload(userId);
        return this.limiter.enqueue(method, payload)
            .then(() => {
                this.progress.sentCount++;
                this.progress.results.push({ userId, status: 'success', timestamp: new Date() });
            })
            .catch((error) => {
                this.progress.failedCount++;
                const errorMsg = error instanceof TelegramApiError ? error.description : error.message;
                this.progress.results.push({ userId, status: 'failed', error: errorMsg, timestamp: new Date() });
                this.log(`Failed to send to ${userId}: ${errorMsg}`);
            })
            .finally(() => {
                // Always report progress
                this.options.onProgress(this.progress);
            });
    });

    await Promise.allSettled(promises);

    // Final check on status before finishing
    if (this.status === 'running') {
        this.log('Campaign completed.');
        this.status = 'completed';
    } else {
        this.log(`Campaign finished with status: ${this.status}`);
    }
    
    this.limiter.stop();
    this.options.onFinish(this.status, this.progress);
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