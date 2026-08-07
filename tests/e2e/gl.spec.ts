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

  /**
   * GL 월드가 캔버스 상자와 같다는 것 하나가 "DOM이 놓은 자리에 그린다"의 전부다.
   * 둘이 같으면 `getBoundingClientRect()`의 값을 변환 없이 넣어도 맞고, 다르면
   * 그 비율만큼 전부 어긋난다.
   *
   * 예전엔 `window.innerWidth`로 월드를 세웠다. 캔버스는 스크롤바를 뺀 레이아웃
   * 뷰포트를 차지하므로 월드 1280 / 상자 1265 — 오른쪽 열이 11.7px 왼쪽에 그려졌다.
   * 눈으로도 스크린샷으로도 안 잡혀서 배포까지 갔다.
   */
  test('GL 월드는 창이 아니라 캔버스 상자를 따른다', async ({ page }) => {
    const geometry = () =>
      page.evaluate(() => {
        const canvas = document.querySelector('canvas')!
        const box = canvas.getBoundingClientRect()
        return {
          box: [box.width, box.height] as [number, number],
          world: window.__vluuGl!.inspect().viewport,
          inner: [window.innerWidth, window.innerHeight] as [number, number],
          inline: canvas.getAttribute('style') ?? '',
        }
      })

    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)
    await expect.poll(async () => (await geometry()).world[0]).toBeGreaterThan(1)

    const before = await geometry()
    expect(before.world).toEqual(before.box)
    /*
     * OGL은 setSize마다 인라인 width/height를 쓴다. 남으면 CSS의 100%를 이겨서
     * 상자가 캔버스 기본 크기(300×150)에 갇히고, 그걸 다시 재는 순환에 빠진다.
     */
    expect(before.inline).not.toContain('width')

    // 창이 바뀌어도 따라간다. 상자가 실제로 달라진 뒤에도 여전히 같아야 한다.
    await page.setViewportSize({ width: 900, height: 700 })
    await expect.poll(async () => (await geometry()).world[0]).not.toBe(before.world[0])

    const after = await geometry()
    expect(after.world).toEqual(after.box)
  })

  /**
   * 아카이브 인덱스는 읽는 화면이다. 굴리는 내내 사진이 일렁이면 정돈된 그리드로 만든
   * 이유가 사라진다. 왜곡은 노선 스트립(`data-gl-motion`)에서만 스크롤을 받는다.
   */
  test('인덱스는 아무리 굴려도 왜곡되지 않는다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)

    const peak = await page.evaluate(async () => {
      let worst = 0
      for (let i = 0; i < 40; i++) {
        window.scrollBy(0, 220)
        await new Promise((r) => requestAnimationFrame(r))
        const v = window.__vluuGl!.inspect().velocity
        worst = Math.max(worst, Math.hypot(v[0], v[1]))
      }
      return worst
    })
    expect(peak, '인덱스를 굴렸는데 셰이더가 반응한다').toBe(0)
  })

  test('커서를 올려 움직이면 그 사진이 반응하고, 손을 멈추면 멎는다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)

    const frame = page.locator('[data-photo]').first()
    const box = (await frame.boundingBox())!
    const y = box.y + box.height / 2

    /*
     * 최대치는 페이지 안에서 잡는다. 밖에서 폴링하면 왕복하는 사이에 감쇠가 끝나
     * 반응이 있었는지 없었는지 구분할 수 없다.
     */
    await page.evaluate(() => {
      const state = { peak: 0 }
      ;(window as unknown as { __peak: typeof state }).__peak = state
      const tick = () => {
        const v = window.__vluuGl?.inspect().velocity ?? [0, 0]
        state.peak = Math.max(state.peak, Math.hypot(v[0], v[1]))
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })

    // 올려놓기만 하고 손을 멈추면 아무 일도 없어야 한다. 반응하는 건 움직임이지 존재가 아니다.
    await page.mouse.move(box.x + 8, y)
    await page.waitForTimeout(400)
    await page.evaluate(() => ((window as unknown as { __peak: { peak: number } }).__peak.peak = 0))
    await page.waitForTimeout(300)
    expect(
      await page.evaluate(() => (window as unknown as { __peak: { peak: number } }).__peak.peak),
      '가만히 있는 커서가 사진을 밀고 있다',
    ).toBe(0)

    await page.mouse.move(box.x + box.width - 8, y, { steps: 12 })
    expect(
      await page.evaluate(() => (window as unknown as { __peak: { peak: number } }).__peak.peak),
      '커서가 사진을 밀지 못한다',
    ).toBeGreaterThan(0)

    // 손을 멈추면 0으로 돌아온다. 손을 떼고도 떨리면 정지가 정지처럼 안 보인다.
    await expect
      .poll(
        () => page.evaluate(() => Math.hypot(...window.__vluuGl!.inspect().velocity)),
        { timeout: 3000 },
      )
      .toBe(0)
  })

  test('손가락은 호버가 아니다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)

    // 터치로 들어온 포인터를 호버로 받으면, 탭 한 번에 사진이 들어앉은 채로 남는다.
    const hovered = await page.evaluate(async () => {
      const el = document.querySelector<HTMLElement>('[data-photo]')!
      const r = el.getBoundingClientRect()
      for (let i = 0; i < 10; i++) {
        window.dispatchEvent(
          new PointerEvent('pointermove', {
            clientX: r.left + 10 + i * 5,
            clientY: r.top + r.height / 2,
            pointerType: 'touch',
          }),
        )
        await new Promise((res) => requestAnimationFrame(res))
      }
      return window.__vluuGl!.inspect().hovered
    })
    expect(hovered).toBeNull()
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
