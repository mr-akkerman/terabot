import { expect, test } from '@playwright/test';
import {
  controlButton,
  mockTelegram,
  readCampaignState,
  seedCampaign,
  waitForCampaignStatus,
  waitForRequests,
} from './helpers';

const BLOCKED = 'Forbidden: bot was blocked by the user';

test.describe('Campaign sending', () => {
  test('runs in a Web Worker and delivers to everyone except blocked users', async ({ page, context }) => {
    const telegram = await mockTelegram(context, { rateLimitOnce: [7] });
    const workers: string[] = [];
    page.on('worker', (worker) => workers.push(worker.url()));

    await seedCampaign(page, { users: 200 });
    await page.goto('/campaigns/c1');
    await controlButton(page, 'Start').click();

    const state = await waitForCampaignStatus(page, 'completed');

    expect(workers.some((url) => url.includes('terabot-campaigns'))).toBe(true);
    expect(state.recipients).toEqual({ success: 180, failed: 20 });
    expect(state.errors).toEqual({ [BLOCKED]: 20 });
    // 429 повторён, а не записан в failed; лишних запросов нет
    expect(telegram.requests.filter((r) => r.status === 429)).toHaveLength(1);
    expect(telegram.deliveries.size).toBe(200);
    expect(telegram.duplicates()).toEqual([]);
  });

  test('keeps a steady ~29 msg/s without bursts', async ({ page, context }) => {
    const telegram = await mockTelegram(context, { isBlocked: () => false });
    await seedCampaign(page, { users: 150 });
    await page.goto('/campaigns/c1');
    await controlButton(page, 'Start').click();
    await waitForCampaignStatus(page, 'completed');

    const times = telegram.requests.map((r) => r.at).sort((a, b) => a - b);
    let maxPerSecond = 0;
    for (let i = 0, j = 0; i < times.length; i++) {
      while (times[i] - times[j] >= 1000) j++;
      maxPerSecond = Math.max(maxPerSecond, i - j + 1);
    }
    // Точный лимит (≤ 29 в любом окне на стороне отправителя) проверяет юнит-тест лимитера.
    // Здесь время меряется на стороне получателя, и браузерный пул соединений + перехват
    // Playwright добавляют джиттер в пару запросов. Ловим именно залпы: старый
    // token bucket давал до ~58 запросов в первую секунду.
    expect(maxPerSecond).toBeLessThanOrEqual(34);
    const rate = (times.length - 1) / ((times[times.length - 1] - times[0]) / 1000);
    expect(rate).toBeLessThanOrEqual(29.5);
    expect(rate).toBeGreaterThan(25);
  });

  test('pause stops sending and resume continues without duplicates', async ({ page, context }) => {
    const telegram = await mockTelegram(context);
    await seedCampaign(page, { users: 200 });
    await page.goto('/campaigns/c1');
    await controlButton(page, 'Start').click();

    await waitForRequests(page, telegram, 40);
    await controlButton(page, 'Pause').click();
    const paused = await waitForCampaignStatus(page, 'paused');
    expect(paused.recipients.pending).toBeGreaterThan(0);

    await page.waitForTimeout(500); // дать долететь запросам, что были в полёте
    const requestsAtPause = telegram.requests.length;
    await page.waitForTimeout(1500);
    expect(telegram.requests.length).toBe(requestsAtPause);

    await controlButton(page, 'Resume').click();
    const state = await waitForCampaignStatus(page, 'completed');
    expect(state.recipients).toEqual({ success: 180, failed: 20 });
    expect(telegram.duplicates()).toEqual([]);
  });

  test('stop ends the campaign and leaves the rest unsent', async ({ page, context }) => {
    const telegram = await mockTelegram(context);
    await seedCampaign(page, { users: 300 });
    await page.goto('/campaigns/c1');
    await controlButton(page, 'Start').click();

    await waitForRequests(page, telegram, 30);
    await controlButton(page, 'Stop').click();
    const state = await waitForCampaignStatus(page, 'stopped');
    await page.waitForTimeout(1500);

    expect(telegram.deliveries.size).toBeLessThan(300);
    expect(state.recipients.pending).toBeGreaterThan(0);
  });

  test('falls back to the main thread when Web Workers are unavailable', async ({ page, context }) => {
    await context.addInitScript(() => {
      // @ts-expect-error — эмулируем браузер без Web Worker
      delete window.Worker;
    });
    const telegram = await mockTelegram(context);
    const logs: string[] = [];
    page.on('console', (message) => logs.push(message.text()));

    await seedCampaign(page, { users: 100 });
    await page.goto('/campaigns/c1');
    await controlButton(page, 'Start').click();
    const state = await waitForCampaignStatus(page, 'completed');

    expect(logs.some((line) => line.includes('Web Worker unavailable'))).toBe(true);
    expect(state.recipients).toEqual({ success: 90, failed: 10 });
    expect(telegram.duplicates()).toEqual([]);
  });

  test('warns before closing the tab while a campaign is sending', async ({ page, context }) => {
    await mockTelegram(context);
    await seedCampaign(page, { users: 300 });
    await page.goto('/campaigns/c1');
    await controlButton(page, 'Start').click();
    await expect(controlButton(page, 'Pause')).toBeVisible();

    const dialog = page.waitForEvent('dialog');
    await page.close({ runBeforeUnload: true });
    const beforeUnload = await dialog;
    expect(beforeUnload.type()).toBe('beforeunload');
    await beforeUnload.dismiss();
  });
});

test.describe('Recovery after reload', () => {
  test('resumes a campaign interrupted by a page reload', async ({ page, context }) => {
    const telegram = await mockTelegram(context);
    await seedCampaign(page, { users: 300 });
    await page.goto('/campaigns/c1');
    await controlButton(page, 'Start').click();
    await waitForRequests(page, telegram, 60);

    await page.reload();
    await expect(page.getByText('resumed after page reload')).toBeVisible();

    const state = await waitForCampaignStatus(page, 'completed');
    expect(state.recipients).toEqual({ success: 270, failed: 30 });
    expect(telegram.deliveries.size).toBe(300);
    // Ответы на запросы, которые были в полёте в момент перезагрузки, теряются —
    // эти получатели могут получить сообщение повторно. Их не больше одной секунды отправки.
    expect(telegram.duplicates().length).toBeLessThanOrEqual(29);
  });

  test('a second tab does not run a campaign that is already sending', async ({ page, context }) => {
    const telegram = await mockTelegram(context);
    await seedCampaign(page, { users: 200 });
    await page.goto('/campaigns/c1');
    await controlButton(page, 'Start').click();
    await waitForRequests(page, telegram, 20);

    const secondTab = await context.newPage();
    await secondTab.goto('/campaigns/c1');
    await secondTab.waitForTimeout(1000);
    await expect(secondTab.getByText('resumed after page reload')).toHaveCount(0);

    await waitForCampaignStatus(page, 'completed');
    expect(telegram.duplicates()).toEqual([]);
  });

  test('a campaign that cannot be resumed is paused instead of hanging in "running"', async ({ page }) => {
    await seedCampaign(page, { users: 10, status: 'running', withoutBot: true });
    await page.reload();

    await expect(page.getByText('could not be resumed and was paused')).toBeVisible();
    const state = await readCampaignState(page);
    expect(state.status).toBe('paused');
  });
});
