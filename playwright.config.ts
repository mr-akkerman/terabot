import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  // Тесты пишут в общую IndexedDB только внутри своего браузерного контекста,
  // но гоняют реальные рассылки с лимитом 29/с — параллельность только мешает замерам.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/campaigns`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
