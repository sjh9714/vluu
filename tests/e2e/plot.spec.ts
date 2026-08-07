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
    `${withGps} of ${route.photos.length} frames have coordinates`,
  )
})

test('칸마다 지도가 실제로 깔려 있다', async ({ page }) => {
  /*
   * 지도는 alt=""인 장식 이미지라 없어도 화면에 티가 안 난다 — 그냥 흰 칸이 되고
   * 점과 선은 그대로 그려진다. 노선을 고치고 `pnpm basemaps`를 잊으면 조용히 반쪽이 된다.
   */
  await page.goto('/c/kanto')
  const cells = page.locator('[data-route-plot] li')
  const count = await cells.count()
  expect(count).toBeGreaterThan(1)

  const loaded = await page.evaluate(() =>
    [...document.querySelectorAll('[data-route-plot] li img')].map((n) => {
      const img = n as HTMLImageElement
      return { src: img.getAttribute('src'), ok: img.complete && img.naturalWidth > 0 }
    }),
  )
  expect(loaded.length, '칸마다 지도가 하나씩 있어야 한다').toBe(count)
  expect(loaded.every((m) => m.ok), `안 뜬 지도: ${JSON.stringify(loaded.filter((m) => !m.ok))}`).toBe(true)
})

test('지도 표기를 빠뜨리지 않는다', async ({ page }) => {
  // 고르는 문제가 아니라 라이선스 조건이다. 지도를 쓰는 대가로 화면에 있어야 한다.
  await page.goto('/c/kanto')
  await expect(page.locator('[data-route-plot]')).toContainText('OpenStreetMap')
  await expect(page.locator('[data-route-plot]')).toContainText('CARTO')
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
   *
   * 축척 숫자는 SVG가 아니라 칸 아래 글에 있다. 안에 두면 칸이 좁아질 때 같이 줄어들어
   * 폰에서 5px짜리 글자가 된다 — 막대는 그림이라 줄어도 뜻이 남지만 숫자는 아니다.
   */
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('[data-route-plot] li')].map(
      (cell) =>
        [...cell.querySelectorAll('p:last-of-type span')]
          .map((s) => s.textContent ?? '')
          .find((t) => /^\d[\d.]*\s*(km|m)$/.test(t)) ?? null,
    ),
  )

  const days = labels.slice(1) // 첫 칸은 개요다
  expect(days.length).toBe(getRoute('kanto')!.legs.length)
  expect(days.every(Boolean), '축척이 없는 칸이 있다').toBe(true)
  expect(new Set(days).size, '모든 날이 같은 축척이면 나눈 의미가 없다').toBeGreaterThan(1)
})

test('폰에서 도면이 사진을 압도하지 않는다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '좁은 화면의 비율 문제다')
  await page.goto('/c/kanto')

  /*
   * 한 줄에 한 칸씩 쌓였을 때 실측: 도면 2064px 대 사진 스트립 498px — 페이지의 67%가
   * 도면이었다. 사진 보러 온 페이지에서 도면이 사진의 네 배를 먹는 건 순서가 뒤집힌 것이다.
   */
  const { columns, share } = await page.evaluate(() => {
    const plot = document.querySelector('[data-route-plot]')!
    const grid = plot.querySelector('ol')!
    return {
      columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
      share: plot.getBoundingClientRect().height / document.documentElement.scrollHeight,
    }
  })

  expect(columns, '좁은 화면에서 한 줄에 한 칸씩 쌓이고 있다').toBe(2)
  expect(share, `도면이 페이지의 ${Math.round(share * 100)}%다`).toBeLessThan(0.5)
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
