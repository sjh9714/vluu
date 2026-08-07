import { expect, test } from '@playwright/test'

/**
 * 열릴 때의 한 장면.
 *
 * 여기서 검사하는 건 "예쁜가"가 아니라 **절제되는가**다 — 사진은 건드리지 않는지,
 * 한 번 돌고 마는지. 인덱스로 돌아올 때마다 다시 조립되면 그게 제일 빨리 질린다.
 */

const running = (page: import('@playwright/test').Page, selector: string) =>
  page.evaluate(
    (s) => document.querySelector(s)?.getAnimations().filter((a) => a.playState === 'running')
      .length ?? 0,
    selector,
  )

test('아직 안 열렸으면 크롬이 조립된다', async ({ page }) => {
  await page.goto('/')

  /*
   * 시각으로 재지 않는다. 장면은 700ms인데 goto가 돌아올 때쯤엔 이미 끝나 있어서,
   * "지금 돌고 있나"를 물으면 코드가 멀쩡해도 실패한다.
   *
   * 대신 상태를 되돌려놓고 규칙이 실제로 걸리는지 본다 — 애니메이션은 CSS가
   * 첫 페인트부터 돌리고, `[data-opened]`가 없는 동안이 그 창이다.
   */
  const before = await page.evaluate(() => {
    document.documentElement.removeAttribute('data-opened')
    const read = (s: string) => getComputedStyle(document.querySelector(s)!).animationName
    return { rule: read('.vluu-rule'), first: read('.vluu-open-1'), third: read('.vluu-open-3') }
  })

  expect(before.rule, '헤어라인이 안 그려진다').toContain('vluu-draw')
  expect(before.first).toContain('vluu-settle')
  expect(before.third).toContain('vluu-settle')
})

test('사진에는 애니메이션이 걸리지 않는다', async ({ page }) => {
  await page.goto('/')

  /*
   * LCP가 0.6초인 건 첫 화면 사진이 곧바로 칠해지기 때문이다. 거기에 페이드를 걸면
   * 그 숫자가 무너지고, 68장을 동시에 애니메이션하는 건 "프레임 떨구는 아름다움은
   * 입상 못 한다"에 정확히 걸린다.
   */
  const animated = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-photo] img, [data-photo], picture')].filter(
        (n) => n.getAnimations().length > 0,
      ).length,
  )
  expect(animated, '사진에 애니메이션이 걸려 있다').toBe(0)
})

test('한 번 돌고 나면 다시 돌지 않는다', async ({ page }) => {
  await page.goto('/')
  await expect
    .poll(() => page.evaluate(() => document.documentElement.hasAttribute('data-opened')), {
      timeout: 4000,
    })
    .toBe(true)

  // 노선으로 갔다가 인덱스로 돌아온다 — 클라이언트 내비게이션이라 문서는 그대로다.
  await page.getByLabel('Routes').getByRole('link', { name: 'Kantō' }).click()
  await page.waitForURL('**/c/kanto')
  await page.getByLabel('Routes').getByRole('link', { name: 'Index' }).click()
  await page.waitForURL(/\/$/)

  expect(
    await page.evaluate(() => document.documentElement.hasAttribute('data-opened')),
    '돌아왔더니 다시 조립됐다',
  ).toBe(true)
  expect(await running(page, '.vluu-rule')).toBe(0)
})

test('모션을 끈 사람에게는 장면이 없다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForTimeout(300)

  // 전역 리셋이 0.01ms로 만든다 — 즉 최종 상태다.
  expect(await running(page, '.vluu-rule')).toBe(0)
  const opacity = await page.evaluate(
    () => getComputedStyle(document.querySelector('.vluu-open-1')!).opacity,
  )
  expect(opacity).toBe('1')
})

test('헤더 아래 선은 여전히 거기 있다', async ({ page }) => {
  await page.goto('/')
  await page.waitForTimeout(900)

  /*
   * 이 선은 border-bottom이었다. scaleX로 그릴 수 없어 엘리먼트로 바꿨는데,
   * 그러다 선 자체가 사라지면 헤더와 격자의 경계가 없어진다.
   */
  const rule = await page.evaluate(() => {
    const header = document.querySelector('header')!
    const line = header.querySelector('.vluu-rule')!
    const h = header.getBoundingClientRect()
    const r = line.getBoundingClientRect()
    return { width: Math.round(r.width), headerWidth: Math.round(h.width), bottom: Math.round(r.bottom - h.bottom) }
  })
  expect(rule.width).toBe(rule.headerWidth)
  expect(Math.abs(rule.bottom)).toBeLessThanOrEqual(1)
})
