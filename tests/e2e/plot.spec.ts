import { expect, test } from '@playwright/test'
import { ROUTE_LIST, getRoute } from '../../src/lib/photos'

/**
 * 노선 도면.
 *
 * 도면은 틀려도 화면이 멀쩡해 보인다 — 점은 어딘가에 찍히고 선은 어쨌든 이어진다.
 * 그래서 여기서 검사하는 건 "그려지는가"가 아니라 **"콘텐츠가 말하는 것과 같은가"**다.
 */

const located = (slug: string) =>
  getRoute(slug)!.photos.filter((p) => p.exif.gps)

const uniqueKeys = (page: import('@playwright/test').Page) =>
  page.evaluate(() => [
    ...new Set(
      [...document.querySelectorAll('[data-plot-key]')].map(
        (n) => (n as HTMLElement).dataset['plotKey']!,
      ),
    ),
  ])

for (const route of ROUTE_LIST) {
  test(`${route.slug} 도면의 점이 좌표를 가진 프레임과 정확히 일치한다`, async ({ page }) => {
    await page.goto(`/c/${route.slug}`)
    const plot = page.locator(`[data-route-plot="${route.slug}"]`)
    await expect(plot).toBeAttached()

    const expected = located(route.slug).map((p) => p.key).sort()
    expect((await uniqueKeys(page)).sort()).toEqual(expected)
  })
}

test('좌표가 없는 프레임은 그리지 않고, 몇 장인지 밝힌다', async ({ page }) => {
  // 간토에 EXIF가 지워진 한 장이 있다. 조용히 빠지면 도면이 노선을 잘못 말하게 된다.
  const route = getRoute('kanto')!
  const withGps = located('kanto').length
  expect(withGps, '이 테스트의 전제가 사라졌다 — 간토가 전부 좌표를 갖고 있다').toBeLessThan(
    route.photos.length,
  )

  await page.goto('/c/kanto')
  await expect(page.locator('[data-route-plot] p').first()).toContainText(
    `${withGps} of ${route.photos.length} frames carry coordinates`,
  )
})

test('좌표가 한 자리뿐인 노선은 선을 그리지 않는다', async ({ page }) => {
  // 강화는 두 장이 같은 좌표다. 이으면 있지도 않은 이동을 그리는 것이다.
  const points = located('ganghwa').map((p) => `${p.exif.gps!.lat},${p.exif.gps!.lon}`)
  expect(new Set(points).size, '강화가 더 이상 한 자리가 아니다').toBe(1)

  await page.goto('/c/ganghwa')
  const plot = page.locator('[data-route-plot="ganghwa"]')
  await expect(plot.locator('polyline')).toHaveCount(0)
  await expect(plot).toContainText('One place')
})

test('하루마다 자기 축척으로 그린다', async ({ page }) => {
  await page.goto('/c/kanto')

  /*
   * 처음엔 노선 전체를 한 장에 그렸는데, 하코네 왕복 70km가 축척을 지배해서
   * 도쿄의 38장이 한구석에 뭉쳤다. 하루씩 나눈 게 그 해결이므로, 칸마다
   * **서로 다른** 축척이 붙어 있는지가 그 해결이 살아있다는 증거다.
   */
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('[data-route-plot] svg')].map((svg) => {
      const texts = [...svg.querySelectorAll('text')].map((t) => t.textContent ?? '')
      return texts.find((t) => /\d\s*(km|m)$/.test(t) || t === 'one place') ?? null
    }),
  )

  const days = labels.slice(1) // 첫 칸은 개요다
  expect(days.length).toBe(getRoute('kanto')!.legs.length)
  expect(days.every(Boolean), '축척이 없는 칸이 있다').toBe(true)
  expect(new Set(days).size, '모든 날이 같은 축척이면 나눈 의미가 없다').toBeGreaterThan(1)
})

test('스트립을 굴리면 도면의 표시가 따라온다', async ({ page }) => {
  await page.goto('/c/kanto')
  const strip = page.locator('[data-gl-motion]')
  const current = () =>
    page.evaluate(
      () =>
        (document.querySelector('[data-plot-key][data-current]') as HTMLElement | null)?.dataset[
          'plotKey'
        ] ?? null,
    )

  await expect.poll(current).not.toBeNull()
  const first = await current()

  /*
   * 스크롤 위치를 직접 옮긴다. 휠→가로 변환은 transit.spec이 이미 검사하고,
   * 모바일 WebKit에는 휠이 아예 없다. 여기서 확인할 건 **스트립이 어디에 있든
   * 도면이 그 자리를 가리키는가**이지 무엇이 스트립을 옮겼는가가 아니다.
   */
  await strip.evaluate((el) => {
    el.scrollLeft = el.scrollWidth
  })

  await expect.poll(current, { timeout: 3000 }).not.toBe(first)

  await strip.evaluate((el) => {
    el.scrollLeft = 0
  })
  await expect.poll(current, { timeout: 3000 }).toBe(first)
})

test('점을 누르면 그 사진이 열리고, 보고 있던 자리는 그대로다', async ({ page }) => {
  await page.goto('/c/kansai')

  const mark = page.locator('[data-plot-key]').nth(3)
  await mark.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)

  const key = await mark.getAttribute('data-plot-key')
  const slug = located('kansai').find((p) => p.key === key)!.slug
  const before = await page.evaluate(() => window.scrollY)

  /*
   * 도면 마크는 SVG 안의 링크이고 Next의 Link다 — 그래서 스트립의 프레임을 눌렀을 때와
   * 똑같이 인터셉트되어 모달로 뜬다.
   *
   * 예전엔 클릭을 가로채 스트립을 그 프레임으로 굴렸는데, 스트립이 도면 위에 있어서
   * 페이지가 400px 위로 튀었다. 보고 있던 게 화면 밖으로 나가면 그건 답이 아니다.
   */
  await mark.dispatchEvent('click')

  await expect(page).toHaveURL(new RegExp(`/p/${slug}$`))
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - before)).toBeLessThan(4)
})

test('도면은 탭 순서를 두 번 채우지 않는다', async ({ page }) => {
  await page.goto('/c/kanto')

  /*
   * 도면의 링크는 전부 스트립에 이미 있는 것이다. 키보드 사용자에게 같은 57개를
   * 두 번 지나가게 하는 값이 도면이 주는 값보다 크다. 도면이 말하는 내용은 글로도 옆에 있다.
   */
  const focusable = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-plot-key]')].filter(
        (n) => (n as HTMLElement).tabIndex >= 0,
      ).length,
  )
  expect(focusable).toBe(0)

  // 대신 도면이 말하는 것은 글로 읽을 수 있어야 한다.
  await expect(page.locator('[data-route-plot] p').first()).toContainText('north to south')
})
