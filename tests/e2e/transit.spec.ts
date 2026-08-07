import { expect, test } from '@playwright/test'
import { ROUTE_LIST } from '../../src/lib/photos'

/**
 * 노선은 가로로 통과한다.
 *
 * 여기서 검사하는 건 "예쁘게 흐르는가"가 아니라 **통과할 수 있는가**다 —
 * 일반 마우스에는 가로 휠이 없어서, 이 변환이 없으면 트랙패드 사용자만 이 화면을
 * 볼 수 있다. 그리고 셰이더가 실제로 반응하는지 — 고치기 전에는 정확히 0이었다.
 */

const route = ROUTE_LIST.reduce((a, b) => (a.photos.length >= b.photos.length ? a : b))
const strip = '[role="region"]'

const state = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const s = document.querySelector('[role="region"]')!
    const field = s.parentElement!
    return {
      left: Math.round(s.scrollLeft),
      span: Math.round(s.scrollWidth - s.clientWidth),
      progress: Number(getComputedStyle(field).getPropertyValue('--progress')),
      pageY: Math.round(window.scrollY),
    }
  })

test.describe('가로 통과', () => {
  test.skip(({ isMobile }) => isMobile, '모바일 WebKit에는 휠이 없다 — 터치가 브라우저 기본으로 동작한다')

  test('세로 휠이 가로 이동으로 바뀐다', async ({ page }) => {
    await page.goto(`/c/${route.slug}`)
    await page.locator(strip).hover()

    const before = await state(page)
    expect(before.left).toBe(0)

    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 400)
      await page.waitForTimeout(50)
    }

    const after = await state(page)
    expect(after.left, '스트립이 가로로 움직여야 한다').toBeGreaterThan(0)
    // 스트립이 먹었으면 페이지는 제자리다.
    expect(after.pageY).toBe(before.pageY)
  })

  test('끝에 닿으면 휠을 놓아준다', async ({ page }) => {
    await page.goto(`/c/${route.slug}`)
    await page.locator(strip).hover()

    /*
     * 페이지가 실제로 더 스크롤되는지로는 못 본다 — 이 화면은 세로로 거의 안 길어서
     * 페이지 자체의 여유가 100px도 안 된다. 이벤트를 먹었는지를 직접 본다.
     */
    const cancelledAtEnd = await page.evaluate(() => {
      const s = document.querySelector('[role="region"]')!
      s.scrollLeft = s.scrollWidth
      const event = new WheelEvent('wheel', { deltaY: 400, cancelable: true, bubbles: true })
      s.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(cancelledAtEnd, '끝에서 이벤트를 계속 먹으면 페이지가 잠긴 것처럼 느껴진다').toBe(false)

    const cancelledInMiddle = await page.evaluate(() => {
      const s = document.querySelector('[role="region"]')!
      s.scrollLeft = Math.floor((s.scrollWidth - s.clientWidth) / 2)
      const event = new WheelEvent('wheel', { deltaY: 400, cancelable: true, bubbles: true })
      s.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(cancelledInMiddle, '중간에서는 가로챈다').toBe(true)
  })

  test('트랙패드의 가로 스와이프는 건드리지 않는다', async ({ page }) => {
    await page.goto(`/c/${route.slug}`)

    // 브라우저가 이미 옳게 처리한다. 여기 끼어들면 두 번 움직인다.
    const cancelled = await page.evaluate(() => {
      const s = document.querySelector('[role="region"]')!
      const event = new WheelEvent('wheel', { deltaX: 400, deltaY: 10, cancelable: true, bubbles: true })
      s.dispatchEvent(event)
      return event.defaultPrevented
    })
    expect(cancelled).toBe(false)
  })
})

test('진행 레일이 스크롤을 따라간다', async ({ page }) => {
  await page.goto(`/c/${route.slug}`)
  expect((await state(page)).progress).toBe(0)

  await page.evaluate(() => {
    const s = document.querySelector('[role="region"]')!
    s.scrollLeft = s.scrollWidth
  })
  await page.waitForTimeout(300)

  const end = await state(page)
  expect(end.progress).toBeGreaterThan(0.99)
})

test('구간 눈금이 실제 경계에 놓인다', async ({ page }) => {
  await page.goto(`/c/${route.slug}`)
  await page.waitForTimeout(500)

  const ticks = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-leg-tick]')].map((t) =>
      Number.parseFloat(t.style.left),
    ),
  )

  expect(ticks).toHaveLength(route.legs.length)
  // 사진 장수로 비례 배분하면 구분 카드 폭이 빠져 어긋난다. 실측이므로 단조 증가해야 한다.
  expect(ticks.every((v) => Number.isFinite(v))).toBe(true)
  expect(ticks).toEqual([...ticks].sort((a, b) => a - b))
  expect(ticks.at(-1)!).toBeLessThan(100)
})

test('키보드만으로 노선을 통과할 수 있다', async ({ page, isMobile }) => {
  test.skip(isMobile, '모바일 WebKit은 Tab으로 포커스를 옮기지 않는다')
  await page.goto(`/c/${route.slug}`)

  await page.locator(strip).focus()
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(300)

  expect((await state(page)).left, '방향키로 움직이지 않는다').toBeGreaterThan(0)
})

test.describe('셰이더 반응', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium에서만 WebGL을 켠다')

  test('가로로 움직이면 속도가 셰이더로 전달되고, 멈추면 0으로 돌아온다', async ({ page }) => {
    await page.goto(`/c/${route.slug}`)
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)
    await page.waitForTimeout(600)
    await page.locator(strip).hover()

    /*
     * 고치기 전에는 여기가 정확히 0이었다. GL이 window.scrollX/Y만 봤기 때문에
     * 컨테이너가 움직이는 이 화면에서는 uVelocity가 영원히 0이었고,
     * 만들어둔 전단·배럴·색수차가 전부 죽어 있었다.
     */
    let peak = 0
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(45)
      const v = await page.evaluate(() => Math.abs(window.__vluuGl!.inspect().velocity[0]))
      peak = Math.max(peak, v)
    }
    expect(peak, '가로 스크롤이 셰이더에 닿지 않는다').toBeGreaterThan(0)

    await expect
      .poll(() => page.evaluate(() => Math.abs(window.__vluuGl!.inspect().velocity[0])), {
        timeout: 3000,
      })
      .toBe(0)
  })

  test('모션을 끄면 GL은 꺼지되 스트립은 여전히 통과할 수 있다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/c/${route.slug}`)
    await page.waitForTimeout(600)

    expect(await page.evaluate(() => document.documentElement.dataset['gl'] ?? null)).toBeNull()

    await page.locator(strip).hover()
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 400)
      await page.waitForTimeout(50)
    }
    // 연출은 없어도 이동은 되어야 한다. 폴백은 열화판이 아니다.
    expect((await state(page)).left).toBeGreaterThan(0)
  })
})
