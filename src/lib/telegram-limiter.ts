import { TelegramAPI, TelegramApiError, SendMessagePayload, SendPhotoPayload } from '@/utils/telegram';

const MESSAGES_PER_SECOND = 29; // Stay just under the 30 message/sec limit

type SendApiMethods = 'sendMessage' | 'sendPhoto';

interface QueueItem<T> {
  method: SendApiMethods;
  payload: T;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  retryCount: number;
}

export class TelegramLimiter {
  private queue: QueueItem<any>[] = [];
  private api: TelegramAPI;
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private lastRequestTime = 0;

  constructor(api: TelegramAPI) {
    this.api = api;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.processQueue();
  }

  public stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public enqueue<T extends SendMessagePayload | SendPhotoPayload>(method: SendApiMethods, payload: T): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({ method, payload, resolve, reject, retryCount: 0 });
    });
  }

  private processQueue() {
    if (!this.isRunning) return;

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const delay = 1000 / MESSAGES_PER_SECOND;

    if (this.queue.length > 0 && timeSinceLastRequest >= delay) {
      this.lastRequestTime = now;
      this.sendNextMessage();
    }
    
    // Schedule the next check
    this.timer = setTimeout(() => this.processQueue(), Math.max(0, delay - timeSinceLastRequest));
  }

  private async sendNextMessage() {
    const item = this.queue.shift();
    if (!item) return;

    try {
      let result;
      if (item.method === 'sendMessage') {
        result = await this.api.sendMessage(item.payload as SendMessagePayload);
      } else if (item.method === 'sendPhoto') {
        result = await this.api.sendPhoto(item.payload as SendPhotoPayload);
      }
      item.resolve(result);
    } catch (error) {
        if (error instanceof TelegramApiError && error.error_code === 429) {
            const retryAfter = error.parameters?.retry_after ?? 5; // default to 5s
            console.warn(`[TelegramLimiter] Rate limit hit. Retrying after ${retryAfter} seconds.`);
            // Pause processing
            this.stop();
            // Re-queue the item
            this.queue.unshift(item); 
            // Resume after delay
            setTimeout(() => this.start(), retryAfter * 1000);
        } else {
             // For other errors, just reject
            item.reject(error);
        }
    }
  }
} 