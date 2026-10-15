import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LimiterStoppedError, TelegramLimiter } from '@/lib/telegram-limiter';
import { TelegramAPI, TelegramApiError, type SendMessagePayload } from '@/utils/telegram';

type Handler = (payload: SendMessagePayload) => Promise<unknown>;

/** Фейковый Bot API: записывает время каждого запроса и отвечает через handler. */
function createApi(handler: Handler = async () => ({ ok: true })) {
  const calls: { chatId: number; at: number }[] = [];
  const api = {
    sendMessage: vi.fn(async (payload: SendMessagePayload) => {
      calls.push({ chatId: Number(payload.chat_id), at: Date.now() });
      return handler(payload);
    }),
    sendPhoto: vi.fn(),
  } as unknown as TelegramAPI;
  return { api, calls };
}

const msg = (chatId: number): SendMessagePayload => ({ chat_id: chatId, text: 'hi' });

function maxInAnyWindow(times: number[], windowMs = 1000) {
  const sorted = [...times].sort((a, b) => a - b);
  let max = 0;
  for (let i = 0, j = 0; i < sorted.length; i++) {
    while (sorted[i] - sorted[j] >= windowMs) j++;
    max = Math.max(max, i - j + 1);
  }
  return max;
}

describe('TelegramLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never sends more than 29 requests in any 1 s window and keeps ~29 msg/s', async () => {
    const { api, calls } = createApi();
    const limiter = new TelegramLimiter(api);
    limiter.start();

    const results = Array.from({ length: 290 }, (_, i) => limiter.enqueue('sendMessage', msg(i + 1)));
    await vi.advanceTimersByTimeAsync(10_500);
    await Promise.all(results);

    expect(calls).toHaveLength(290);
    expect(maxInAnyWindow(calls.map((c) => c.at))).toBeLessThanOrEqual(29);
    const duration = calls[calls.length - 1].at - calls[0].at;
    expect(duration).toBeGreaterThanOrEqual(9_000);
    expect(duration).toBeLessThan(10_500);
    limiter.stop();
  });

  it('does not burst after being idle', async () => {
    const { api, calls } = createApi();
    const limiter = new TelegramLimiter(api);
    limiter.start();

    await vi.advanceTimersByTimeAsync(5_000); // простой с пустой очередью
    const results = Array.from({ length: 10 }, (_, i) => limiter.enqueue('sendMessage', msg(i + 1)));
    await vi.advanceTimersByTimeAsync(1_000);
    await Promise.all(results);

    const gaps = calls.slice(1).map((c, i) => c.at - calls[i].at);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(30);
    limiter.stop();
  });

  it('on 429 pauses for retry_after and retries only that request, without rejecting the queue', async () => {
    let rateLimited = false;
    const { api, calls } = createApi(async (payload) => {
      if (payload.chat_id === 3 && !rateLimited) {
        rateLimited = true;
        throw new TelegramApiError(429, 'Too Many Requests: retry after 2', { retry_after: 2 });
      }
      return { ok: true };
    });
    const limiter = new TelegramLimiter(api);
    limiter.start();

    const settledPromise = Promise.allSettled(
      Array.from({ length: 50 }, (_, i) => limiter.enqueue('sendMessage', msg(i + 1))),
    );
    await vi.advanceTimersByTimeAsync(10_000);
    const settled = await settledPromise;

    expect(settled.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(calls.filter((c) => c.chatId === 3)).toHaveLength(2);
    expect(calls).toHaveLength(51);

    // После 429 следующие запросы ушли не раньше, чем через retry_after
    const rateLimitedAt = calls.find((c) => c.chatId === 3)!.at;
    const nextAt = calls.find((c) => c.at > rateLimitedAt)!.at;
    expect(nextAt - rateLimitedAt).toBeGreaterThanOrEqual(2_000);
    limiter.stop();
  });

  it('retries network errors and 5xx with backoff', async () => {
    let failures = 0;
    const { api, calls } = createApi(async () => {
      if (failures < 2) {
        failures++;
        if (failures === 1) throw new TypeError('Failed to fetch');
        throw new TelegramApiError(502, 'Bad Gateway');
      }
      return { ok: true };
    });
    const limiter = new TelegramLimiter(api);
    limiter.start();

    const result = limiter.enqueue('sendMessage', msg(1));
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(result).resolves.toBeDefined();
    expect(calls).toHaveLength(3);
    limiter.stop();
  });

  it('rejects non-retryable errors (e.g. user blocked the bot) immediately', async () => {
    const { api, calls } = createApi(async (payload) => {
      if (payload.chat_id === 2) throw new TelegramApiError(403, 'Forbidden: bot was blocked by the user');
      return { ok: true };
    });
    const limiter = new TelegramLimiter(api);
    limiter.start();

    const settledPromise = Promise.allSettled([1, 2, 3].map((id) => limiter.enqueue('sendMessage', msg(id))));
    await vi.advanceTimersByTimeAsync(1_000);
    const settled = await settledPromise;

    expect(settled.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect((settled[1] as PromiseRejectedResult).reason).toBeInstanceOf(TelegramApiError);
    expect(calls).toHaveLength(3);
    limiter.stop();
  });

  it('gives up after max retries', async () => {
    const { api, calls } = createApi(async () => {
      throw new TelegramApiError(500, 'Internal Server Error');
    });
    const limiter = new TelegramLimiter(api);
    limiter.start();

    const result = limiter.enqueue('sendMessage', msg(1));
    const assertion = expect(result).rejects.toBeInstanceOf(TelegramApiError);
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
    expect(calls).toHaveLength(6); // 1 попытка + 5 повторов
    limiter.stop();
  });

  it('stop() rejects queued requests with LimiterStoppedError without sending them', async () => {
    const { api, calls } = createApi();
    const limiter = new TelegramLimiter(api);
    limiter.start();

    const results = Array.from({ length: 100 }, (_, i) => limiter.enqueue('sendMessage', msg(i + 1)));
    await vi.advanceTimersByTimeAsync(500);
    limiter.stop();
    const settled = await Promise.allSettled(results);

    const sent = calls.length;
    expect(sent).toBeGreaterThan(0);
    expect(sent).toBeLessThan(100);
    const rejected = settled.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected).toHaveLength(100 - sent);
    expect(rejected.every((r) => r.reason instanceof LimiterStoppedError)).toBe(true);
  });

  it('a request rate-limited while stopping is reported as not sent (LimiterStoppedError)', async () => {
    let release!: () => void;
    const { api } = createApi(
      () => new Promise((_, reject) => {
        release = () => reject(new TelegramApiError(429, 'Too Many Requests', { retry_after: 1 }));
      }),
    );
    const limiter = new TelegramLimiter(api);
    limiter.start();

    const result = limiter.enqueue('sendMessage', msg(1));
    const assertion = expect(result).rejects.toBeInstanceOf(LimiterStoppedError);
    await vi.advanceTimersByTimeAsync(10);
    limiter.stop();
    release();
    await assertion;
  });

  it('enqueue() on a stopped limiter rejects with LimiterStoppedError', async () => {
    const { api } = createApi();
    const limiter = new TelegramLimiter(api);
    await expect(limiter.enqueue('sendMessage', msg(1))).rejects.toBeInstanceOf(LimiterStoppedError);
  });
});
