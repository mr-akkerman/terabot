import { TelegramAPI, TelegramApiError, SendMessagePayload, SendPhotoPayload } from '@/utils/telegram';

const MESSAGES_PER_SECOND = 29; // Stay just under the 30 message/sec limit
const WINDOW_MS = 1000;
// Запросы идут равномерно, по одному раз в ~34 мс: пачки по 29 штук из-за сетевого
// джиттера слипаются на стороне Telegram и превышают лимит. Если браузер всё же
// зажмёт таймер (fallback в главном потоке), догоняем пропущенные слоты пачкой —
// но не больше одного окна, так что средняя скорость не просядет.
const SEND_INTERVAL_MS = WINDOW_MS / MESSAGES_PER_SECOND;
const MAX_RETRIES = 5;
const DEFAULT_RETRY_AFTER_S = 5;

type SendApiMethods = 'sendMessage' | 'sendPhoto';

/**
 * Запрос так и не ушёл в Telegram, потому что лимитер остановили (пауза/стоп).
 * Получатель должен остаться в статусе pending и быть обработан при возобновлении.
 */
export class LimiterStoppedError extends Error {
  constructor(message = 'Campaign stopped') {
    super(message);
    this.name = 'LimiterStoppedError';
  }
}

interface QueueItem<T> {
  method: SendApiMethods;
  payload: T;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  retryCount: number;
}

/**
 * Ошибки, после которых имеет смысл повторить запрос: сеть отвалилась
 * (fetch бросает TypeError) или Telegram ответил 5xx.
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof TelegramApiError) return error.error_code >= 500;
  return error instanceof TypeError;
}

/**
 * Rate limiter для Bot API: равномерный темп + скользящее окно.
 *
 * - Запросы распределены по времени с шагом SEND_INTERVAL_MS.
 * - В любом интервале длиной WINDOW_MS уходит не больше MESSAGES_PER_SECOND запросов.
 * - На 429 весь лимитер встаёт на паузу на retry_after, а запрос
 *   возвращается в начало очереди. Остальные запросы НЕ отклоняются.
 */
export class TelegramLimiter {
  private queue: QueueItem<SendMessagePayload | SendPhotoPayload>[] = [];
  private api: TelegramAPI;
  private isRunning = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  // Время отправки последних запросов (не больше MESSAGES_PER_SECOND штук)
  private sentAt: number[] = [];
  // Время последнего «использованного» слота равномерного расписания
  private lastSlotAt = 0;
  private pausedUntil = 0;

  constructor(api: TelegramAPI) {
    this.api = api;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.resetSchedule(Date.now());
    this.scheduleTick(0);
  }

  public stop() {
    this.isRunning = false;
    this.clearTimer();
    // Отклоняем все оставшиеся в очереди запросы
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        item.reject(new LimiterStoppedError());
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
        reject(new LimiterStoppedError('Limiter is not running'));
        return;
      }
      if (this.queue.length === 0) this.resetSchedule(Date.now());
      this.queue.push({ method, payload, resolve, reject, retryCount: 0 });
      this.scheduleTick(0);
    });
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Расписание начинается с момента `from`: после простоя не догоняем прошлые слоты залпом. */
  private resetSchedule(from: number) {
    this.lastSlotAt = Math.max(this.lastSlotAt, from - SEND_INTERVAL_MS);
  }

  private scheduleTick(delayMs: number) {
    if (!this.isRunning || this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.tick();
    }, delayMs);
  }

  private tick() {
    if (!this.isRunning) return;

    const now = Date.now();
    if (now < this.pausedUntil) {
      this.resetSchedule(this.pausedUntil);
      this.scheduleTick(this.pausedUntil - now);
      return;
    }

    while (this.sentAt.length > 0 && this.sentAt[0] < now - WINDOW_MS) {
      this.sentAt.shift();
    }
    // Сколько слотов равномерного расписания уже наступило (догоняем не больше одного окна)
    this.lastSlotAt = Math.max(this.lastSlotAt, now - WINDOW_MS);
    const dueSlots = Math.floor((now - this.lastSlotAt) / SEND_INTERVAL_MS);
    const windowCapacity = MESSAGES_PER_SECOND - this.sentAt.length;
    let toSend = Math.min(dueSlots, windowCapacity, this.queue.length);

    while (toSend-- > 0) {
      this.lastSlotAt += SEND_INTERVAL_MS;
      this.sentAt.push(now);
      this.sendNextMessage();
    }

    // Если очередь пуста — засыпаем, enqueue() разбудит.
    if (this.queue.length > 0) {
      const nextSlotIn = this.lastSlotAt + SEND_INTERVAL_MS - now;
      const windowFreesIn = this.sentAt.length >= MESSAGES_PER_SECOND ? this.sentAt[0] + WINDOW_MS - now : 0;
      this.scheduleTick(Math.max(1, nextSlotIn, windowFreesIn));
    }
  }

  private async sendNextMessage() {
    const item = this.queue.shift();
    if (!item) return;
    if (!this.isRunning) {
      item.reject(new LimiterStoppedError());
      return;
    }

    try {
      let result;
      if (item.method === 'sendMessage') {
        result = await this.api.sendMessage(item.payload as SendMessagePayload);
      } else if (item.method === 'sendPhoto') {
        result = await this.api.sendPhoto(item.payload as SendPhotoPayload);
      }
      item.resolve(result);
    } catch (error) {
      const isRateLimit = error instanceof TelegramApiError && error.error_code === 429;
      const isRetryable = isRateLimit || isTransientError(error);

      if (!this.isRunning) {
        // Лимитер остановили, пока запрос был в полёте. Если ошибка временная —
        // сообщение не доставлено, оставляем получателя в pending до возобновления.
        item.reject(isRetryable ? new LimiterStoppedError() : error);
        return;
      }

      if (isRetryable && item.retryCount < MAX_RETRIES) {
        item.retryCount++;
        const retryAfterS = isRateLimit
          ? error.parameters?.retry_after ?? DEFAULT_RETRY_AFTER_S
          : 2 ** item.retryCount; // 2, 4, 8, 16, 32 сек для сетевых ошибок и 5xx
        console.warn(
          `[TelegramLimiter] ${isRateLimit ? 'Rate limit hit' : 'Transient error'}. ` +
          `Retry ${item.retryCount}/${MAX_RETRIES} after ${retryAfterS}s.`,
        );
        this.pausedUntil = Math.max(this.pausedUntil, Date.now() + retryAfterS * 1000);
        this.queue.unshift(item);
        this.scheduleTick(0);
        return;
      }

      item.reject(error);
    }
  }
}
