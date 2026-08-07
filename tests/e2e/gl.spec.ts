import { expect, test } from '@playwright/test'

/**
 * GL 레이어는 덧칠이다. 그러므로 검사할 것은 "예쁘게 그려지는가"가 아니라
 * **"꺼졌을 때 사이트가 온전한가"**와 **"켜졌을 때 DOM과 같은 자리를 그리는가"**다.
 *
 * 데스크톱 Chromium만 본다 — 헤드리스 WebKit에는 쓸 만한 WebGL이 없고,
 * 없는 환경에서 폴백으로 내려가는 것 자체가 올바른 동작이다.
 */
test.describe('WebGL 레이어', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium에서만 WebGL을 켠다')

  test('켜지면 DOM 이미지를 숨기고 캔버스가 대신 그린다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset['gl'])).toBe('on')

    // 인계는 사진 하나하나 단위이고 페이드가 붙어 있다. 끝나기를 기다린다.
    await expect
      .poll(() =>
        page.evaluate(() => getComputedStyle(document.querySelector('[data-photo] img')!).opacity),
      )
      .toBe('0')

    // 캔버스는 그림만 그린다. 클릭·포커스는 전부 아래 DOM이 받아야 한다.
    const events = await page.evaluate(
      () => getComputedStyle(document.querySelector('canvas')!).pointerEvents,
    )
    expect(events).toBe('none')
  })

  test('켜져 있어도 사진을 눌러 뷰어로 갈 수 있다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset['gl'])).toBe('on')
    await page.locator('[data-photo]').first().click()
    await expect(page).toHaveURL(/\/p\//)
  })

  test('모션을 끄면 아예 켜지 않는다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForTimeout(600)

    const state = await page.evaluate(() => ({
      gl: document.documentElement.dataset['gl'] ?? null,
      off: document.documentElement.dataset['glOff'] ?? null,
      opacity: getComputedStyle(document.querySelector('[data-photo] img')!).opacity,
    }))
    expect(state.gl).toBeNull()
    expect(state.off).toBe('reduced-motion')
    // 폴백은 열화판이 아니다 — DOM 이미지가 그대로 보인다.
    expect(state.opacity).toBe('1')
  })

  test('라우트를 옮겨도 살아있고 새 화면을 따라간다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset['gl'])).toBe('on')

    await page.getByRole('link', { name: 'Kantō' }).click()
    await page.waitForURL('**/c/kanto')

    const frames = await page.locator('[data-photo]').count()
    await expect
      .poll(() => page.evaluate(() => window.__vluuGl?.inspect().tracked ?? 0))
      .toBe(frames)
  })

  test('스크롤하면 속도가 셰이더로 전달된다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)

    const moving = await page.evaluate(async () => {
      let peak = 0
      for (let i = 0; i < 20; i++) {
        window.scrollBy(0, 220)
        await new Promise((r) => requestAnimationFrame(r))
        peak = Math.max(peak, Math.abs(window.__vluuGl!.inspect().velocity[1]))
      }
      return peak
    })
    expect(moving, '스크롤 중에는 속도가 0이 아니어야 한다').toBeGreaterThan(0)

    // 멈추면 되돌아온다. 손을 떼고도 떨리면 정지 상태가 정지처럼 안 보인다.
    // 감쇠가 경과 시간에 걸려 있으므로 소프트웨어 래스터라이저에서도 같은 시간 안에 멎어야 한다.
    await expect
      .poll(() => page.evaluate(() => Math.abs(window.__vluuGl!.inspect().velocity[1])), {
        timeout: 3000,
      })
      .toBe(0)
  })

  test('텍스처는 예산 안에서만 승격된다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)

    await page.evaluate(async () => {
      for (let i = 0; i < 40; i++) {
        window.scrollBy(0, 400)
        await new Promise((r) => requestAnimationFrame(r))
      }
    })
    await page.waitForTimeout(1000)

    /*
     * 68장을 전부 GPU에 실제 이미지로 올리면 수백 MB다.
     * 예산은 24장이고, 되돌리는 데 쓸 LQIP를 그때 받아오므로 몇 프레임 늦게 수렴한다.
     */
    const frames = await page.locator('[data-photo]').count()
    expect(await page.evaluate(() => window.__vluuGl!.inspect().textures)).toBe(frames)
    await expect
      .poll(() => page.evaluate(() => window.__vluuGl!.inspect().promoted), { timeout: 5000 })
      .toBeLessThan(frames / 2)
  })

  test('강도를 0으로 내리면 왜곡이 사라진다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)

    await page.evaluate(() => window.__vluuGl!.setIntensity(0))
    expect(await page.evaluate(() => window.__vluuGl!.inspect().intensity)).toBe(0)
  })
})
