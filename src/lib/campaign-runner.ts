import type { Campaign, UserBase, Bot, CampaignProgress } from '@/types';
import { TelegramAPI, TelegramApiError, SendMessagePayload, SendPhotoPayload } from '@/utils/telegram';

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
  private readonly userIds: number[];

  constructor(private readonly options: CampaignRunnerOptions) {
    this.api = new TelegramAPI(options.bot.token, { logger: console.log });
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
    this.runLoop();
  }

  public pause() {
    if (this.status === 'running') {
      this.log('Pausing campaign...');
      this.status = 'paused';
    }
  }

  public stop() {
    this.log('Stopping campaign...');
    this.status = 'stopped';
  }

  private async runLoop() {
    const { campaign } = this.options;
    const { chunkSize, intervalMs } = campaign.sendSettings;

    while (this.progress.sentCount + this.progress.failedCount < this.progress.totalUsers) {
      if (this.status !== 'running') {
        this.log(`Loop halted. Status: ${this.status}`);
        this.options.onFinish(this.status, this.progress);
        return;
      }

      const offset = this.progress.sentCount + this.progress.failedCount;
      const chunk = this.userIds.slice(offset, offset + chunkSize);
      
      this.log(`Processing chunk of ${chunk.length} users (offset: ${offset}).`);

      const promises = chunk.map(userId => this.sendMessageToUser(userId));
      const results = await Promise.allSettled(promises);

      results.forEach((result, i) => {
        const userId = chunk[i];
        if (result.status === 'fulfilled') {
          this.progress.sentCount++;
          this.progress.results.push({ userId, status: 'success', timestamp: new Date() });
        } else {
          this.progress.failedCount++;
          const errorMsg = result.reason instanceof TelegramApiError ? result.reason.description : result.reason.message;
          this.progress.results.push({ userId, status: 'failed', error: errorMsg, timestamp: new Date() });
          this.log(`Failed to send to ${userId}: ${errorMsg}`);
        }
      });
      
      this.options.onProgress(this.progress);

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    this.log('Campaign completed.');
    this.status = 'completed';
    this.options.onFinish(this.status, this.progress);
  }

  private sendMessageToUser(userId: number) {
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
        const payload: SendPhotoPayload = {
            ...commonPayload,
            photo: message.photo,
            caption: message.text,
        };
        return this.api.sendPhoto(payload);
    } else {
        const payload: SendMessagePayload = {
            ...commonPayload,
            text: message.text,
        };
        return this.api.sendMessage(payload);
    }
  }

  private log(message: string) {
    console.log(`[CampaignRunner:${this.options.campaign.id}] ${message}`);
  }
} 