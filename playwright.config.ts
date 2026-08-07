import { defineConfig, devices } from '@playwright/test'

// 이 프로젝트 전용 포트. 기본 3000은 다른 앱이 물고 있을 수 있고,
// reuseExistingServer가 그걸 우리 서버로 착각해 엉뚱한 앱을 테스트한다.
const PORT = Number(process.env.PORT ?? 4321)
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 15 Pro'] } },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
