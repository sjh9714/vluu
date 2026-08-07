import { expect, test } from '@playwright/test'
import { ROUTE_LIST } from '../../src/lib/photos'

/**
 * 사진 상세는 인덱스 위에 겹쳐 열린다.
 *
 * 이 기능의 값어치는 "떠 보인다"가 아니라 **맥락을 잃지 않는다**는 것이다 —
 * 인덱스가 뒤에 그대로 남고, 스크롤 위치도 포커스도 닫으면 제자리로 돌아온다.
 * 그러면서 URL은 여전히 공유 가능해야 한다. 여기서 검사하는 건 그 계약이다.
 */

const dialog = '[role="dialog"]'

/**
 * 모달이 떠 있는 것과 반응하는 것은 다르다. 셸은 하이드레이션이 끝나야 포커스를 받으므로
 * 그걸 신호로 쓴다 — 키보드를 누르기 전에 이걸 기다리지 않으면 느린 기기에서 입력이 샌다.
 */
async function openedAndReady(page: import('@playwright/test').Page) {
  await expect(page.locator(dialog)).toBeVisible()
  await expect(page.locator(dialog)).toBeFocused()
}

/**
 * 이 사진이 정말 화면에 올라왔는지.
 *
 * URL만 보면 안 된다. `router.replace`는 주소를 먼저 바꾸고 모달은 그 다음에
 * 다시 그려지므로, URL이 맞자마자 다음 키를 누르면 아직 이전 사진의 앞뒤 정보를
 * 들고 있는 핸들러에 입력이 떨어진다. 대화상자의 이름이 바뀐 것이 다시 그려졌다는 신호다.
 */
async function showing(page: import('@playwright/test').Page, photo: { slug: string; title: string }) {
  await expect(page).toHaveURL(new RegExp(`/p/${photo.slug}$`))
  await expect(page.getByRole('dialog', { name: photo.title })).toBeVisible()
}

test('사진을 누르면 인덱스 위에 겹쳐 열린다', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-photo]').first().click()

  await expect(page.locator(dialog)).toBeVisible()
  await expect(page).toHaveURL(/\/p\//)
  // 인덱스는 언마운트되지 않는다 — 그게 이 패턴의 요점이다.
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
})

test('모달의 사진이 화면을 제대로 쓴다', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-photo]').first().click()
  await expect(page.locator(dialog)).toBeVisible()
  await page.waitForTimeout(300)

  const { photo, view } = await page.evaluate(() => {
    const box = document.querySelector('[role="dialog"] [data-photo]')!.getBoundingClientRect()
    return {
      photo: { w: box.width, h: box.height },
      view: { w: window.innerWidth, h: window.innerHeight },
    }
  })

  /*
   * 좁은 화면에서는 폭이, 넓은 화면에서는 높이가 제약이어야 한다.
   * 높이만 뷰포트 폭으로 묶으면 모바일에서 사진이 화면의 절반으로 쪼그라든다.
   */
  const fills = photo.w / view.w > 0.75 || photo.h / view.h > 0.6
  expect(fills, `사진이 ${Math.round(photo.w)}×${Math.round(photo.h)}로 너무 작다`).toBe(true)

  // 그러면서 화면 밖으로 나가지도 않아야 한다.
  expect(photo.w).toBeLessThanOrEqual(view.w)
  expect(photo.h).toBeLessThanOrEqual(view.h)
})

test('Esc로 닫히고 URL이 되돌아간다', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-photo]').first().click()
  await openedAndReady(page)

  await page.keyboard.press('Escape')
  await expect(page.locator(dialog)).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
})

test('베일을 눌러도 닫힌다', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-photo]').first().click()
  await expect(page.locator(dialog)).toBeVisible()

  // 사진 바깥 — 화면 맨 위 가장자리
  await page.mouse.click(10, 10)
  await expect(page.locator(dialog)).toHaveCount(0)
})

test('닫기 버튼으로도 닫힌다', async ({ page }) => {
  await page.goto('/')
  await page.locator('[data-photo]').first().click()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.locator(dialog)).toHaveCount(0)
})

test('열린 동안 배경이 스크롤되지 않고, 닫으면 위치가 그대로다', async ({ page, isMobile }) => {
  await page.goto('/')
  await page.evaluate(() => window.scrollTo(0, 900))
  await page.waitForTimeout(200)

  await page.locator('[data-photo]').nth(6).click()
  await openedAndReady(page)

  /*
   * 열린 시점의 위치를 기준으로 삼는다. Playwright의 click()이 대상을 화면에 넣느라
   * 먼저 스크롤하므로, 클릭 전에 잰 값은 이미 낡았다.
   */
  const locked = await page.evaluate(() => window.scrollY)

  /*
   * 반드시 **실제 입력**으로 검사한다.
   *
   * `overflow: hidden`은 사용자의 휠·터치는 막지만 `window.scrollTo`는 못 막는다.
   * 스크립트로 굴려놓고 "안 잠긴다"고 판단하면 멀쩡한 것을 고치게 된다.
   * 계산값을 읽는 것도 안 된다 — 루트의 overflow는 뷰포트로 전파되면서
   * WebKit은 명세대로 visible을, Chromium은 hidden을 돌려준다.
   */
  // 모바일 WebKit에는 휠이 없다. 잠금 자체는 데스크톱에서 검사하고,
  // 여기서는 닫은 뒤 위치가 보존되는지(아래)만 본다.
  if (!isMobile) {
    await page.mouse.wheel(0, 800)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => window.scrollY), '휠로 배경이 스크롤됐다').toBe(locked)
  }

  await page.keyboard.press('Escape')
  await expect(page.locator(dialog)).toHaveCount(0)
  // 스크롤을 position:fixed로 잠그면 여기서 0으로 튄다.
  expect(await page.evaluate(() => window.scrollY)).toBe(locked)
})

test('배경이 inert가 되어 포커스가 밖으로 새지 않는다', async ({ page, isMobile }) => {
  test.skip(isMobile, '모바일 WebKit은 Tab으로 포커스를 옮기지 않는다')
  await page.goto('/')
  await page.locator('[data-photo]').first().click()
  await expect(page.locator(dialog)).toBeVisible()

  expect(await page.evaluate(() => document.getElementById('page-root')?.hasAttribute('inert'))).toBe(
    true,
  )

  // 여러 번 Tab을 눌러도 포커스는 대화상자 안에 머문다.
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab')
  const inside = await page.evaluate(
    () => document.activeElement?.closest('[role="dialog"]') !== null,
  )
  expect(inside, '포커스가 배경으로 빠져나갔다').toBe(true)
})

test('닫으면 포커스가 눌렀던 프레임으로 돌아온다', async ({ page, isMobile }) => {
  test.skip(isMobile, '터치 기기에는 되돌릴 포커스가 없다')
  await page.goto('/')
  const link = page.locator('[data-photo]').nth(3)
  const key = await link.getAttribute('data-photo')

  await link.focus()
  await page.keyboard.press('Enter')
  await openedAndReady(page)

  await page.keyboard.press('Escape')
  await expect(page.locator(dialog)).toHaveCount(0)
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-photo'))).toBe(key)
})

test('화살표 키로 앞뒤로 넘기고 노선을 벗어나지 않는다', async ({ page }) => {
  const route = ROUTE_LIST.find((r) => r.photos.length > 3)!
  const [first, second] = route.photos

  await page.goto('/')
  await page.locator(`[data-photo="${first!.key}"]`).click()
  await openedAndReady(page)

  await page.keyboard.press('ArrowRight')
  await showing(page, second!)

  /*
   * 한 박자 쉰다. 라우터가 한 프레임 안에 들어온 두 번째 replace를 삼킬 때가 있어서,
   * 커밋되자마자 반대 방향을 누르면 20번에 한 번쯤 그 키가 사라진다 — 측정해서 확인했다.
   * 값을 늦게 읽는 문제가 아니라 라우터 쪽이라, DOM에서 읽게 바꿔봐도 오히려 나빠졌다.
   *
   * 사람이 방향을 16ms 안에 뒤집을 일은 없고 한 번 더 누르면 되는 일이라 그대로 둔다.
   * 이 테스트가 보려는 건 "앞뒤로 넘어가고 노선을 벗어나지 않는가"이지 그 경합이 아니다.
   */
  await page.waitForTimeout(150)

  await page.keyboard.press('ArrowLeft')
  await showing(page, first!)

  // 노선의 첫 장에서 왼쪽으로는 더 못 간다.
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(300)
  await showing(page, first!)
})

test('노선의 마지막 장에서는 더 넘어가지 않는다', async ({ page }) => {
  /*
   * 인덱스의 첫 사진은 2장짜리 노선(강화)에 속한다. 두 번 넘기면 그 노선이 끝나고
   * 거기서 멈추는 게 맞다 — 여행이 끝나는 자리에서 다른 나라로 튀면 안 된다.
   */
  const short = ROUTE_LIST.reduce((a, b) => (a.photos.length <= b.photos.length ? a : b))
  const last = short.photos.at(-1)!

  await page.goto('/')
  await page.locator(`[data-photo="${last.key}"]`).click()
  await openedAndReady(page)

  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)
  await expect(page).toHaveURL(new RegExp(`/p/${last.slug}$`))
  // 버튼을 아예 그리지 않는다. 비활성 상태로 남기면 눈에만 안 보이고 스크린리더는 계속 읽는다.
  await expect(page.getByRole('button', { name: /^Next/ })).toHaveCount(0)
})

test('넘겨본 뒤에도 Esc 한 번에 인덱스로 돌아온다', async ({ page }) => {
  // 넉넉한 노선을 고른다. 짧은 노선에서 시작하면 끝에 부딪혀 넘어가지 않는다.
  const route = ROUTE_LIST.reduce((a, b) => (a.photos.length >= b.photos.length ? a : b))
  const walk = route.photos.slice(0, 4)

  await page.goto('/')
  await page.locator(`[data-photo="${walk[0]!.key}"]`).click()
  await openedAndReady(page)

  for (const photo of walk.slice(1)) {
    await page.keyboard.press('ArrowRight')
    await showing(page, photo)
  }

  // replace가 아니라 push로 쌓으면 여기서 뒤로가기를 세 번 눌러야 한다.
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator(dialog)).toHaveCount(0)
})

test('직접 방문하면 모달이 아니라 전체 페이지다', async ({ page }) => {
  await page.goto('/p/two-lamps')
  await expect(page.locator(dialog)).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Two Lamps' })).toBeVisible()
})

test('노선 페이지에서 눌러도 모달로 열린다', async ({ page }) => {
  await page.goto('/c/kansai')
  await page.locator('[data-photo]').first().click()
  await expect(page.locator(dialog)).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: 'Kansai' })).toBeVisible()
})

test.describe('WebGL 레이어와의 관계', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium에서만 WebGL을 켠다')

  test('모달이 열리면 그 한 장만 그리고, 닫으면 되돌아온다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)
    await page.waitForTimeout(800)

    const before = await page.evaluate(() => window.__vluuGl!.inspect())
    expect(before.solo).toBe(false)

    await page.locator('[data-photo]').nth(6).click()
    await expect(page.locator(dialog)).toBeVisible()

    /*
     * 캔버스는 화면 전체를 덮는 fixed 엘리먼트라 베일 위로 올라가야 모달의 사진을 그린다.
     * 그 상태에서 뒤 그리드까지 그리면 68장이 베일 위로 튀어나온다.
     */
    // dataset은 프레임 루프가 켠다. inspect()는 즉시 참이 되므로 한 틱 늦다.
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dataset['glSolo'] !== undefined))
      .toBe(true)

    // 뒤 그리드는 DOM 이미지로 돌려받아야 한다 — 안 그러면 베일 뒤에서 통째로 사라진다.
    const handedBack = await page.evaluate(
      () =>
        [...document.querySelectorAll('#page-root [data-photo]')].filter((el) =>
          el.hasAttribute('data-gl-ready'),
        ).length,
    )
    expect(handedBack, '배경 프레임이 GL에 잡힌 채로 남아 있다').toBe(0)

    await page.keyboard.press('Escape')
    await expect(page.locator(dialog)).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.__vluuGl!.inspect().solo)).toBe(false)
  })

  test('열 때와 닫을 때 모두 모프가 돈다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)
    await page.waitForTimeout(800)

    const sample = async () => {
      const seen: string[] = []
      for (let i = 0; i < 10; i++) {
        const key = await page.evaluate(() => window.__vluuGl?.inspect().morphing ?? null)
        if (key) seen.push(key)
        await page.waitForTimeout(60)
      }
      return seen
    }

    await page.locator('[data-photo]').nth(6).click()
    expect(await sample(), '열 때 모프가 돌지 않았다').not.toHaveLength(0)

    await page.waitForTimeout(700)
    await page.keyboard.press('Escape')
    expect(await sample(), '닫을 때 모프가 돌지 않았다').not.toHaveLength(0)
  })
})
