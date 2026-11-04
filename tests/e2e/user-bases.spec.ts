import { expect, test, type Page } from '@playwright/test';

/** Создаёт `count` статических баз «Base 01»…, и кампанию, которая использует «Base 01». */
async function seedUserBases(page: Page, count: number) {
  await page.goto('/user-bases');
  await page.waitForFunction(async () => (await indexedDB.databases()).some((db) => db.name === 'terabot-db'));
  await page.evaluate(async (count) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('terabot-db');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['userBases', 'campaigns'], 'readwrite');
    for (let i = 1; i <= count; i++) {
      const n = String(i).padStart(2, '0');
      tx.objectStore('userBases').put({
        id: `ub${n}`,
        name: `Base ${n}`,
        type: 'static',
        rawUserIds: '1\n2\n3',
        userIds: [1, 2, 3],
        userCount: 3,
        createdAt: new Date(2026, 0, i),
      });
    }
    tx.objectStore('campaigns').put({
      id: 'c1', name: 'Black Friday', botId: 'bot1', userBaseId: 'ub01', createdAt: new Date(), status: 'draft',
      message: { id: 'm1', text: 'hi', parse_mode: 'HTML' }, sendSettings: { intervalMs: 1000, chunkSize: 100 },
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, count);
  await page.reload();
}

async function storedBaseNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('terabot-db');
      request.onsuccess = () => resolve(request.result);
    });
    const bases = await new Promise<{ name: string }[]>((resolve) => {
      const request = db.transaction('userBases').objectStore('userBases').getAll();
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return bases.map((base) => base.name).sort();
  });
}

const selectBox = (page: Page, name: string) => page.getByRole('checkbox', { name: `Select ${name}`, exact: true });
const selectAll = (page: Page) => page.getByRole('checkbox', { name: 'Select all user bases' });

test.describe('User bases bulk delete', () => {
  test('deletes only the selected user bases', async ({ page }) => {
    await seedUserBases(page, 5);

    await expect(page.getByRole('button', { name: 'Delete selected' })).toHaveCount(0);
    await selectBox(page, 'Base 02').check();
    await selectBox(page, 'Base 04').check();
    await expect(page.getByText('2 selected')).toBeVisible();
    await expect(selectAll(page)).toHaveJSProperty('indeterminate', true);

    await page.getByRole('button', { name: 'Delete selected' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText('Delete 2 user bases?')).toBeVisible();
    await expect(dialog.getByRole('listitem')).toHaveText(['Base 02', 'Base 04']);
    await expect(dialog.getByText('won\'t be able to run')).toHaveCount(0); // кампания использует Base 01
    await dialog.getByRole('button', { name: 'Delete 2' }).click();

    await expect(page.getByText('Deleted 2 user bases')).toBeVisible();
    await expect(page.getByText('selected', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('cell', { name: 'Base 02' })).toHaveCount(0);
    expect(await storedBaseNames(page)).toEqual(['Base 01', 'Base 03', 'Base 05']);
  });

  test('select all covers every page, and cancel deletes nothing', async ({ page }) => {
    await seedUserBases(page, 12); // 10 на страницу → две страницы

    await selectAll(page).check();
    await expect(page.getByText('12 selected')).toBeVisible();

    await page.getByRole('button', { name: 'Delete selected' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText('Delete 12 user bases?')).toBeVisible();
    await expect(dialog.getByText('…and 2 more')).toBeVisible();
    await expect(dialog.getByText(/1 campaign uses these\s+user bases \("Black Friday"\)/)).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    expect(await storedBaseNames(page)).toHaveLength(12);
    await page.getByRole('button', { name: 'Clear selection' }).click();
    await expect(page.getByText('12 selected')).toHaveCount(0);
    await expect(selectAll(page)).not.toBeChecked();
  });

  test('select all then delete removes every user base', async ({ page }) => {
    await seedUserBases(page, 12);
    await selectAll(page).check();
    await page.getByRole('button', { name: 'Delete selected' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete 12' }).click();

    await expect(page.getByText('No results.')).toBeVisible();
    expect(await storedBaseNames(page)).toEqual([]);
  });

  test('single delete from the row menu still works and drops the row from the selection', async ({ page }) => {
    await seedUserBases(page, 3);
    await selectBox(page, 'Base 02').check();
    await selectBox(page, 'Base 03').check();

    await page.getByRole('row', { name: /Base 02/ }).getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByText('1 selected')).toBeVisible();
    expect(await storedBaseNames(page)).toEqual(['Base 01', 'Base 03']);
  });
});
