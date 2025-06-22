import type { Campaign, UserBase, Bot, CampaignProgress } from '@/types';
import { TelegramAPI, TelegramApiError } from '@/utils/telegram';
import { TelegramLimiter } from './telegram-limiter';

type RunnerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed';

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
  private readonly userIds: number[];

  constructor(private readonly options: CampaignRunnerOptions) {
    this.api = new TelegramAPI(options.bot.token, { logger: console.log });
    this.limiter = new TelegramLimiter(this.api);
    this.userIds = [...(options.userBase.userIds || [])];
    
    this.progress = options.campaign.progress || {
        campaignId: options.campaign.id,
        totalUsers: this.userIds.length,
        sentCount: 0,
        failedCount: 0,
        results: [],
    };
  }

  public getStatus(): RunnerStatus {
    return this.status;
  }
  
  public start() {
    if (this.status === 'running') return;
    this.log('Starting campaign...');
    this.status = 'running';
    this.limiter.start();
    this.runLoop();
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