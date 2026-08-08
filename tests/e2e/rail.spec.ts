import { expect, test, type Page } from '@playwright/test'
import { ROUTE_LIST } from '../../src/lib/photos'

/**
 * 뷰어의 위치 표시.
 *
 * 이게 생기기 전에는 뷰어가 `Frame 002 / 068`을 띄우면서 앞뒤 이동은 노선 안에서만
 * 돌았다. 강화의 두 번째 사진에서 "66장 남음"과 "End →"가 한 화면에 있었다는 뜻이다.
 * 그래서 여기서 검사하는 건 "레일이 보이는가"가 아니라 **숫자와 컨트롤이 같은 수열을
 * 말하는가**다 — 어긋나도 어느 쪽도 에러를 내지 않는다.
 */

const rail = '[data-viewer-rail]'
const count = '[data-rail-count]'

/** 노선을 장수 순으로. Ganghwa 2 · Kansai 8 · Kantō 58 — 성격이 다 다르다. */
const routes = [...ROUTE_LIST].sort((a, b) => a.photos.length - b.photos.length)

/**
 * 표식이 트랙의 몇 %에 서 있는지. 인라인 px이 아니라 실제 자리로 잰다.
 *
 * 좁은 화면에서는 트랙을 아예 안 그리므로 `null`이다 — 200px짜리 레일에 눈금 넷을
 * 박으면 어디서 갈리는지는 안 보이고 갈린다는 사실만 남는다. **위치라는 정보는 그때도
 * 숫자가 낸다.** 그래서 숫자는 어느 화면에서나 검사하고 그림은 있을 때만 검사한다.
 */
async function markerAt(page: Page): Promise<number | null> {
  return page.evaluate((sel) => {
    const box = document.querySelector(sel)!
    const track = box.querySelector('span[aria-hidden]')!.getBoundingClientRect()
    if (track.width === 0) return null
    const mark = box.querySelector('[data-rail-marker]')!.getBoundingClientRect()
    return ((mark.left + mark.width / 2 - track.left) / track.width) * 100
  }, rail)
}

/** 트랙이 그려졌으면 그 자리를 검사하고, 아니면 넘어간다. */
async function expectMarkerNear(page: Page, percent: number) {
  const at = await markerAt(page)
  if (at !== null) expect(at).toBeCloseTo(percent, 0)
}

test.describe('전체 페이지', () => {
  for (const route of routes) {
    test(`${route.title} — 끝 장에서 N / N이고 다음이 없다`, async ({ page }) => {
      const last = route.photos.at(-1)!
      await page.goto(`/p/${last.slug}`)

      await expect(page.locator(count)).toHaveText(`${route.photos.length} / ${route.photos.length}`)
      /*
         지금 깨져 있던 조합이 정확히 이것이다 — 끝이라고 말하는 컨트롤과
         아직 한참 남았다고 말하는 숫자가 같은 화면에 있었다.
       */
      await expect(page.locator('a[rel="next"]')).toHaveCount(0)
      await expect(page.getByText('End →')).toBeVisible()
      await expectMarkerNear(page, 100)
    })

    test(`${route.title} — 첫 장에서 1 / N이고 이전이 없다`, async ({ page }) => {
      await page.goto(`/p/${route.photos[0]!.slug}`)

      await expect(page.locator(count)).toHaveText(`1 / ${route.photos.length}`)
      await expect(page.locator('a[rel="prev"]')).toHaveCount(0)
      await expectMarkerNear(page, 0)
    })
  }

  test('노선 이름을 두 번 쓰지 않는다', async ({ page }) => {
    const photo = routes.at(-1)!.photos[0]!
    await page.goto(`/p/${photo.slug}`)

    // 레일이 노선을 말하므로 촬영정보의 ROUTE 줄은 없앴다.
    await expect(page.locator('dt', { hasText: /^Route$/ })).toHaveCount(0)
    await expect(page.locator(rail)).toContainText(routes.at(-1)!.title)
  })

  test('카탈로그 번호는 그대로 남는다', async ({ page }) => {
    // 자리는 레일이 말하지만 `035 / 068`은 위치가 아니라 이 프레임의 이름이다.
    const photo = routes.at(-1)!.photos[0]!
    await page.goto(`/p/${photo.slug}`)
    await expect(page.locator('dd').filter({ hasText: /^\d{3} \/ 068$/ })).toHaveCount(1)
  })
})

test.describe('모달', () => {
  test('그리드에서 열어도 전체 페이지와 같은 자리를 말한다', async ({ page }) => {
    const route = routes.at(-1)!
    const photo = route.photos[Math.floor(route.photos.length / 2)]!

    await page.goto(`/p/${photo.slug}`)
    const onPage = await page.locator(count).textContent()

    await page.goto('/')
    await page.locator(`[data-sheet] [data-photo="${photo.key}"]`).first().click()
    await expect(page.locator('[role="dialog"]')).toBeVisible()

    expect(await page.locator(count).textContent()).toBe(onPage)
  })

  test('넘기면 표식이 따라 움직인다', async ({ page }) => {
    const route = routes.at(-1)!
    await page.goto('/')
    await page.locator(`[data-sheet] [data-photo="${route.photos[0]!.key}"]`).first().click()
    await expect(page.locator('[role="dialog"]')).toBeFocused()

    await expectMarkerNear(page, 0)

    await page.keyboard.press('ArrowRight')
    await expect(page.locator(count)).toHaveText(`2 / ${route.photos.length}`)

    // 그림은 넓은 화면에만 있다. 좁은 화면에서 위치를 말하는 건 위의 숫자다.
    const moved = await markerAt(page)
    if (moved !== null) expect(moved).toBeGreaterThan(0)
  })

  test('레일은 GL 추적 대상이 아니다', async ({ page }) => {
    /*
     * 배너에서 배운 것과 같다. 표식이 매 프레임 자리를 바꾸는데 그걸 속도로 읽으면
     * 넘기는 내내 왜곡이 걸린다.
     */
    const photo = routes.at(-1)!.photos[0]!
    await page.goto(`/p/${photo.slug}`)
    expect(await page.locator(`${rail} [data-photo]`).count()).toBe(0)
  })
})

test('사진이 캡션을 덮지 않는다', async ({ page }) => {
  /*
   * 모달의 사진 상자는 `height: 100%`를 쓰는데, 안쪽 격자의 행이 확정돼 있지 않으면
   * 그 퍼센트가 조용히 `auto`로 떨어져 크기가 굳는다. 그러면 창이 낮을수록 사진이
   * 아래로 넘쳐 캡션 글자를 덮었다 — 1440×600에서 329px이 넘쳤다.
   */
  const photo = routes.at(-1)!.photos[0]!
  await page.setViewportSize({ width: 1200, height: 620 })
  await page.goto('/')
  await page.locator(`[data-sheet] [data-photo="${photo.key}"]`).first().click()
  await expect(page.locator('[role="dialog"]')).toBeVisible()

  const gap = await page.evaluate(() => {
    const shell = document.querySelector('[role="dialog"]')!
    const box = shell.querySelector('figure')!.getBoundingClientRect()
    const info = shell.querySelector('[data-viewer-rail]')!.getBoundingClientRect()
    return info.top - box.bottom
  })
  expect(gap, '사진이 캡션 블록 위로 넘쳤다').toBeGreaterThanOrEqual(0)
})
