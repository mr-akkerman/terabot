import type { BrowserContext, Page } from '@playwright/test';

export interface TelegramMockOptions {
  /** chat_id, которые «заблокировали бота» (403) */
  isBlocked?: (chatId: number) => boolean;
  /** chat_id, на первый запрос к которым Telegram ответит 429 */
  rateLimitOnce?: number[];
  /** Задержка ответа, мс (имитация сети) */
  latencyMs?: number;
}

export interface TelegramMock {
  /** Все запросы к Bot API: время, chat_id, HTTP-статус ответа */
  requests: { at: number; chatId: number; status: number }[];
  /** Сколько раз каждому chat_id реально «доставлено» сообщение (200 или 403) */
  deliveries: Map<number, number>;
  duplicates(): number[];
}

/** Подменяет api.telegram.org для всего контекста, включая запросы из Web Worker. */
export async function mockTelegram(context: BrowserContext, options: TelegramMockOptions = {}): Promise<TelegramMock> {
  const { isBlocked = (id) => id % 10 === 0, rateLimitOnce = [], latencyMs = 50 } = options;
  const pending429 = new Set(rateLimitOnce);
  const mock: TelegramMock = {
    requests: [],
    deliveries: new Map(),
    duplicates: () => [...mock.deliveries.entries()].filter(([, n]) => n > 1).map(([id]) => id),
  };

  await context.route('https://api.telegram.org/**', async (route) => {
    let chatId = -1;
    try {
      chatId = Number(JSON.parse(route.request().postData() ?? '{}').chat_id);
    } catch {
      /* sendPhoto шлёт FormData — в этих тестах не используется */
    }
    const json = (status: number, body: object) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pending429.delete(chatId)) {
      mock.requests.push({ at: Date.now(), chatId, status: 429 });
      return json(429, { ok: false, error_code: 429, description: 'Too Many Requests: retry after 1', parameters: { retry_after: 1 } });
    }

    mock.deliveries.set(chatId, (mock.deliveries.get(chatId) ?? 0) + 1);
    if (isBlocked(chatId)) {
      mock.requests.push({ at: Date.now(), chatId, status: 403 });
      return json(403, { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' });
    }

    mock.requests.push({ at: Date.now(), chatId, status: 200 });
    await new Promise((r) => setTimeout(r, latencyMs));
    return json(200, { ok: true, result: { message_id: Date.now(), date: 0, chat: { id: chatId, type: 'private' } } });
  });

  return mock;
}

export interface SeedOptions {
  users: number;
  campaignId?: string;
  status?: string;
  /** Не создавать бота — чтобы кампанию нельзя было запустить */
  withoutBot?: boolean;
}

/** Создаёт бота, статическую базу на `users` получателей и кампанию прямо в IndexedDB приложения. */
export async function seedCampaign(page: Page, { users, campaignId = 'c1', status = 'draft', withoutBot = false }: SeedOptions) {
  // Открываем страницу, которая инициализирует схему БД
  await page.goto('/campaigns');
  await page.waitForFunction(async () => {
    const dbs = await indexedDB.databases();
    return dbs.some((db) => db.name === 'terabot-db');
  });

  await page.evaluate(
    async ({ users, campaignId, status, withoutBot }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('terabot-db');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction(['bots', 'userBases', 'campaigns'], 'readwrite');
      if (!withoutBot) tx.objectStore('bots').put({ id: 'bot1', name: 'Test bot', token: '123:TEST' });
      tx.objectStore('userBases').put({
        id: 'ub1',
        name: 'Test base',
        type: 'static',
        rawUserIds: Array.from({ length: users }, (_, i) => i + 1).join('\n'),
        createdAt: new Date(),
      });
      tx.objectStore('campaigns').put({
        id: campaignId,
        name: `E2E ${campaignId}`,
        botId: 'bot1',
        userBaseId: 'ub1',
        createdAt: new Date(),
        status,
        message: { id: 'm1', text: '<b>Hello</b>', parse_mode: 'HTML' },
        sendSettings: { intervalMs: 1000, chunkSize: 100 },
      });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { users, campaignId, status, withoutBot },
  );
}

export interface CampaignState {
  status: string;
  recipients: Record<string, number>;
  errors: Record<string, number>;
}

export async function readCampaignState(page: Page, campaignId = 'c1'): Promise<CampaignState> {
  return page.evaluate(async (campaignId) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('terabot-db');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const get = <T>(store: string, query: IDBValidKey | IDBKeyRange, all = false) =>
      new Promise<T>((resolve, reject) => {
        const s = db.transaction(store).objectStore(store);
        const request = all ? s.index('campaignId').getAll(query) : s.get(query);
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => reject(request.error);
      });

    const campaign = await get<{ status: string }>('campaigns', campaignId);
    const recipients = await get<{ status: string; error?: string }[]>('campaignRecipients', campaignId, true);
    db.close();

    const counts: Record<string, number> = {};
    const errors: Record<string, number> = {};
    for (const r of recipients) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      if (r.error) errors[r.error] = (errors[r.error] ?? 0) + 1;
    }
    return { status: campaign.status, recipients: counts, errors };
  }, campaignId);
}

export async function waitForCampaignStatus(page: Page, status: string, campaignId = 'c1', timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let state = await readCampaignState(page, campaignId);
  while (state.status !== status) {
    if (Date.now() > deadline) throw new Error(`Campaign ${campaignId} stuck in "${state.status}", expected "${status}"`);
    await page.waitForTimeout(250);
    state = await readCampaignState(page, campaignId);
  }
  return state;
}

/** Ждёт, пока мок получит хотя бы `count` запросов. */
export async function waitForRequests(page: Page, mock: TelegramMock, count: number, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (mock.requests.length < count) {
    if (Date.now() > deadline) throw new Error(`Only ${mock.requests.length}/${count} Telegram requests received`);
    await page.waitForTimeout(100);
  }
}

export const controlButton = (page: Page, name: 'Start' | 'Resume' | 'Pause' | 'Stop' | 'Restart') =>
  page.getByRole('button', { name, exact: true });
