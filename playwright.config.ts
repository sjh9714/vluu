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
  /*
   * 워커를 CPU 절반까지 풀면 한 대의 서버에 68장짜리 페이지 요청이 몰려
   * 응답이 잘리고("Unexpected end of JSON input") 하이드레이션이 죽는다.
   * 제품 문제가 아니라 부하 문제이므로 여기서 막는다.
   */
  workers: process.env.CI ? 2 : 3,

  webServer: {
    /*
     * 개발 서버가 아니라 **실제로 배포되는 빌드**를 상대로 돈다.
     * dev는 요청받은 순간 컴파일하므로 첫 방문마다 타이밍이 흔들리고,
     * 무엇보다 프로덕션에서만 나타나는 문제를 못 잡는다.
     */
    command: `pnpm build && pnpm exec next start --port ${PORT}`,
    url: baseURL,
    /*
     * 살아있는 서버를 재사용하지 않는다. 이번 작업에서 낡은 서버가 옛 코드를
     * 그대로 내보내 테스트가 통과한 적이 두 번 있었다. 매번 새로 굽는 값이
     * 그 착각의 값보다 싸다.
     */
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
