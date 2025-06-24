import { TelegramAPI, TelegramApiError, SendMessagePayload, SendPhotoPayload } from '@/utils/telegram';

const MESSAGES_PER_SECOND = 29; // Stay just under the 30 message/sec limit

type SendApiMethods = 'sendMessage' | 'sendPhoto';

interface QueueItem<T> {
  method: SendApiMethods;
  payload: T;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  retryCount: number;
}

export class TelegramLimiter {
  private queue: QueueItem<SendMessagePayload | SendPhotoPayload>[] = [];
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
    // Отклоняем все оставшиеся в очереди запросы
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        item.reject(new Error('Campaign stopped'));
      }
    }
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public enqueue<T extends SendMessagePayload | SendPhotoPayload>(method: SendApiMethods, payload: T): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // Проверяем, запущен ли лимитер, если нет - сразу отклоняем
      if (!this.isRunning) {
        reject(new Error('Limiter is not running'));
        return;
      }
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
    
    // Schedule the next check only if still running
    if (this.isRunning) {
      this.timer = setTimeout(() => this.processQueue(), Math.max(0, delay - timeSinceLastRequest));
    }
  }

  private async sendNextMessage() {
    const item = this.queue.shift();
    if (!item || !this.isRunning) return;

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