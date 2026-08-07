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
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        // 헤드리스 Chromium은 기본적으로 WebGL이 없다. 소프트웨어 래스터라이저를 붙여야
        // GL 레이어가 실제로 켜지는 경로를 검사할 수 있다. 느리지만 정확하다.
        launchOptions: {
          args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
      },
    },
    // 헤드리스 WebKit에는 쓸 만한 WebGL이 없다. 그래서 이 프로젝트는 폴백 경로를 검사한다 —
    // GL이 없는 환경에서 사이트가 온전한지가 여기서 확인된다.
    { name: 'mobile', use: { ...devices['iPhone 15 Pro'] } },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
