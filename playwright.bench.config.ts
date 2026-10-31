import { defineConfig, devices } from '@playwright/test';

const rows = process.env.BENCH_ROWS ?? '1000000';
const cols = process.env.BENCH_COLS ?? '50';

export default defineConfig({
  testDir: 'bench',
  timeout: 600_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:44731',
    launchOptions: { args: ['--js-flags=--expose-gc'] },
  },
  webServer: {
    command: 'npm run dev -w @opengrid/demo',
    url: 'http://127.0.0.1:44731/bench.html',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  metadata: { rows, cols },
});
