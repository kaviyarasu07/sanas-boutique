import { defineConfig } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'

// Tiny .env loader so there is no extra dependency.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
  }
}

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  // The API flow is one ordered story that shares state; keep it on a single worker.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'api', testMatch: /.*\.api\.spec\.ts/ },
    { name: 'ui', testMatch: /.*\.ui\.spec\.ts/, use: { browserName: 'chromium' } },
    // Frontend only (mocked API) - needs just `npm run dev` in frontend/.
    { name: 'mock', testMatch: /.*\.mock\.spec\.ts/, use: { browserName: 'chromium' } },
  ],
})
