import { expect, test, type Page } from '@playwright/test';
import { controlButton, mockTelegram, waitForCampaignStatus, waitForRequests } from './helpers';

interface StoredBase {
  id: string;
  name: string;
  userCount: number;
  groupId?: string;
  groupName?: string;
  partIndex?: number;
  userIds: number[];
}

interface PartSeed {
  ids: number[];
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

async function openApp(page: Page, path: string) {
  await page.goto(path);
  await page.waitForFunction(async () => (await indexedDB.databases()).some((db) => db.name === 'terabot-db'));
}

/** Создаёт бота, группу «PROMO» из частей PROMO_1… и (опционально) кампанию по всей группе. */
async function seedGroup(page: Page, parts: PartSeed[], withCampaign = false) {
  await page.evaluate(
    async ({ parts, withCampaign }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('terabot-db');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction(['bots', 'userBases', 'campaigns'], 'readwrite');
      tx.objectStore('bots').put({ id: 'bot1', name: 'Test bot', token: '123:TEST' });
      parts.forEach((part, i) => {
        tx.objectStore('userBases').put({
          // id специально идут в обратном порядке: порядок частей задаёт partIndex, а не ключ
          id: `part-${String(parts.length - i).padStart(2, '0')}`,
          name: `PROMO_${i + 1}`,
          type: 'static',
          rawUserIds: part.ids.join('\n'),
          userIds: part.ids,
          userCount: part.ids.length,
          createdAt: new Date(2026, 0, 1),
          groupId: 'g1',
          groupName: 'PROMO',
          partIndex: i + 1,
        });
      });
      tx.objectStore('userBases').put({
        id: 'solo', name: 'Solo base', type: 'static', rawUserIds: '1\n2', userIds: [1, 2], userCount: 2, createdAt: new Date(2026, 0, 2),
      });
      if (withCampaign) {
        tx.objectStore('campaigns').put({
          id: 'c1', name: 'Group campaign', botId: 'bot1', userBaseId: '', userBaseGroupId: 'g1',
          createdAt: new Date(), status: 'draft',
          message: { id: 'm1', text: '<b>Hello</b>', parse_mode: 'HTML' },
          sendSettings: { intervalMs: 1000, chunkSize: 100 },
        });
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { parts, withCampaign },
  );
  await page.reload();
}

async function readStore<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(async (store) => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('terabot-db');
      request.onsuccess = () => resolve(request.result);
    });
    const items = await new Promise<unknown[]>((resolve) => {
      const request = db.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return items;
  }, store) as Promise<T[]>;
}

test.describe('Creating a user base', () => {
  test('a long ID list scrolls inside its field and Save stays reachable', async ({ page }) => {
    await openApp(page, '/user-bases');
    await page.getByRole('button', { name: 'Create User Base' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Big base');
    await dialog.locator('#userIds-file-upload').setInputFiles({
      name: 'ids.txt', mimeType: 'text/plain', buffer: Buffer.from(range(1, 20_000).join('\n')),
    });

    await expect(dialog.getByText('Found 20,000 valid IDs')).toBeVisible();
    const field = dialog.getByLabel('User IDs');
    const box = await field.boundingBox();
    expect(box!.height).toBeLessThan(250);
    expect(await field.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeInViewport({ ratio: 1 });

    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('cell', { name: 'Big base', exact: true })).toBeVisible();
    const bases = await readStore<StoredBase>(page, 'userBases');
    expect(bases.map((b) => [b.name, b.userCount, b.groupId])).toEqual([['Big base', 20_000, undefined]]);
  });

  test('splits a base into linked, numbered parts shown as one expandable row', async ({ page }) => {
    await openApp(page, '/user-bases');
    await page.getByRole('button', { name: 'Create User Base' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('PROMO-СВОИ');
    await dialog.locator('#userIds-file-upload').setInputFiles({
      name: 'ids.txt', mimeType: 'text/plain', buffer: Buffer.from(range(1, 5000).join('\n')),
    });
    await dialog.getByRole('switch', { name: 'Split into parts' }).click();
    await dialog.getByLabel('Rows per part').fill('2000');
    await expect(dialog.getByTestId('split-summary')).toHaveText(
      '3 linked bases: PROMO-СВОИ_1 … PROMO-СВОИ_3 — 2,000 IDs each, last one 1,000.',
    );
    await dialog.getByRole('button', { name: 'Create 3 bases' }).click();

    await expect(page.getByText('Created 3 user bases')).toBeVisible();
    const groupRow = page.getByRole('row', { name: /PROMO-СВОИ 3 parts/ });
    await expect(groupRow).toBeVisible();
    await expect(groupRow.getByRole('cell', { name: '5000', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'PROMO-СВОИ_1' })).toHaveCount(0);

    const toggle = groupRow.getByRole('button', { name: 'PROMO-СВОИ 3 parts' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('row').filter({ hasText: /PROMO-СВОИ_\d/ })).toHaveText([
      /PROMO-СВОИ_1.*2000/, /PROMO-СВОИ_2.*2000/, /PROMO-СВОИ_3.*1000/,
    ]);

    const bases = (await readStore<StoredBase>(page, 'userBases')).sort((a, b) => a.partIndex! - b.partIndex!);
    expect(bases.map((b) => [b.name, b.userCount, b.partIndex, b.groupName])).toEqual([
      ['PROMO-СВОИ_1', 2000, 1, 'PROMO-СВОИ'],
      ['PROMO-СВОИ_2', 2000, 2, 'PROMO-СВОИ'],
      ['PROMO-СВОИ_3', 1000, 3, 'PROMO-СВОИ'],
    ]);
    expect(new Set(bases.map((b) => b.groupId)).size).toBe(1);
    expect(bases[1].userIds[0]).toBe(2001);
    expect(bases[2].userIds.at(-1)).toBe(5000);
  });

  test('does not split when everything fits into one part', async ({ page }) => {
    await openApp(page, '/user-bases');
    await page.getByRole('button', { name: 'Create User Base' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Small');
    await dialog.getByLabel('User IDs').fill('1, 2, 3, 3');
    await dialog.getByRole('switch', { name: 'Split into parts' }).click();
    await expect(dialog.getByTestId('split-summary')).toContainText('a single base will be created');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('cell', { name: 'Small', exact: true })).toBeVisible();
    const bases = await readStore<StoredBase>(page, 'userBases');
    expect(bases.map((b) => [b.name, b.userCount, b.groupId])).toEqual([['Small', 3, undefined]]);
  });
});

test.describe('Base groups in the list', () => {
  test('group checkbox selects its parts; deleting the group removes all of them', async ({ page }) => {
    await openApp(page, '/user-bases');
    await seedGroup(page, [{ ids: range(1, 10) }, { ids: range(11, 20) }, { ids: range(21, 25) }], true);

    await page.getByRole('checkbox', { name: 'Select all parts of PROMO' }).check();
    await expect(page.getByText('3 selected')).toBeVisible();
    await page.getByRole('button', { name: 'Clear selection' }).click();

    await page.getByRole('row', { name: /PROMO 3 parts/ }).getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Delete group' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText('Delete group "PROMO" (3 parts)?')).toBeVisible();
    await expect(dialog.getByRole('listitem')).toHaveText(['PROMO_1', 'PROMO_2', 'PROMO_3']);
    await expect(dialog.getByText(/1 campaign uses these\s+user bases \("Group campaign"\)/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete 3' }).click();

    await expect(page.getByText('Deleted 3 user bases')).toBeVisible();
    expect((await readStore<StoredBase>(page, 'userBases')).map((b) => b.name)).toEqual(['Solo base']);
  });

  test('a whole group can be picked as campaign recipients', async ({ page }) => {
    await openApp(page, '/user-bases');
    await seedGroup(page, [{ ids: range(1, 10) }, { ids: range(11, 15) }]);
    await page.goto('/campaigns/create');

    await page.getByLabel('Campaign Name').fill('To the whole group');
    await page.locator('textarea').nth(1).fill('Hello');
    await page.getByRole('combobox').filter({ hasText: 'Select a user base to target' }).click();
    await expect(page.getByRole('option')).toHaveText(['PROMO — all 2 parts (15 users)', 'PROMO_1', 'PROMO_2', 'Solo base']);
    await page.getByRole('option', { name: 'PROMO — all 2 parts (15 users)' }).click();
    await expect(page.getByText('Group of 2 parts, 15 users in total.')).toBeVisible();
    await page.getByRole('combobox').filter({ hasText: 'Select a bot to send from' }).click();
    await page.getByRole('option', { name: 'Test bot' }).click();
    await page.getByRole('button', { name: 'Create Campaign' }).click();

    await expect(page).toHaveURL(/\/campaigns$/);
    const campaigns = await readStore<{ userBaseId: string; userBaseGroupId?: string }>(page, 'campaigns');
    expect(campaigns.map((c) => [c.userBaseId, c.userBaseGroupId])).toEqual([['', 'g1']]);
  });
});

test.describe('Campaign over a base group', () => {
  test('sends part by part, saves progress after each part and resumes from the right part', async ({ page, context }) => {
    const telegram = await mockTelegram(context, { isBlocked: () => false });
    await openApp(page, '/campaigns');
    // 1 и 2 есть и в первой, и во второй части — второй раз им писать нельзя
    const parts = [{ ids: range(1, 40) }, { ids: [1, 2, ...range(41, 80)] }, { ids: range(81, 100) }];
    await seedGroup(page, parts, true);
    await page.goto('/campaigns/c1');
    await controlButton(page, 'Start').click();

    // Пауза посреди второй части
    await waitForRequests(page, telegram, 55);
    await controlButton(page, 'Pause').click();
    await waitForCampaignStatus(page, 'paused');
    await page.waitForTimeout(500);

    type Progress = { parts: { name: string; totalUsers: number; processedCount: number; status: string }[] };
    let [campaign] = await readStore<{ progress: Progress }>(page, 'campaigns');
    expect(campaign.progress.parts.map((p) => [p.name, p.totalUsers, p.status])).toEqual([
      ['PROMO_1', 40, 'completed'],
      ['PROMO_2', 40, 'running'],
      ['PROMO_3', 20, 'pending'],
    ]);
    expect(campaign.progress.parts[0].processedCount).toBe(40);
    await expect(page.getByTestId('campaign-parts')).toContainText('Parts: 1 of 3 sent');
    // Третью часть ещё не трогали
    expect(telegram.requests.some((r) => r.chatId > 80)).toBe(false);

    await controlButton(page, 'Resume').click();
    const state = await waitForCampaignStatus(page, 'completed');

    expect(state.recipients).toEqual({ success: 100 });
    expect(telegram.deliveries.size).toBe(100);
    expect(telegram.duplicates()).toEqual([]);

    // Части идут строго по очереди: ни одного запроса из следующей части раньше конца предыдущей
    const partOf = (chatId: number) => (chatId <= 40 ? 1 : chatId <= 80 ? 2 : 3);
    const order = telegram.requests.map((r) => partOf(r.chatId));
    expect(order).toEqual([...order].sort((a, b) => a - b));

    [campaign] = await readStore<{ progress: Progress }>(page, 'campaigns');
    expect(campaign.progress.parts.map((p) => [p.processedCount, p.status])).toEqual([
      [40, 'completed'], [40, 'completed'], [20, 'completed'],
    ]);
    await expect(page.getByTestId('campaign-parts')).toContainText('Parts: 3 of 3 sent');
  });
});
