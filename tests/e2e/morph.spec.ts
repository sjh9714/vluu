import { expect, test } from '@playwright/test'

/**
 * 인덱스에서 사진을 누르면, 그 사진이 있던 자리에서 뷰어의 자리로 이어져 그려진다.
 * 이 전환의 값어치는 "부드럽다"가 아니라 **이미지를 다시 받지 않는다**는 데 있다 —
 * 텍스처가 이미 GPU에 있으므로 화면이 바뀌는 동안 네트워크가 조용하다.
 */
test.describe('화면 간 모프', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium에서만 WebGL을 켠다')

  test('사진을 누르면 그 사진이 모프 대상이 된다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)

    const holder = page.locator('[data-sheet] [data-photo]').first()
    const key = await holder.getAttribute('data-photo')
    await holder.click()
    await page.waitForURL(/\/p\//)

    // 새 화면에 그 사진이 도착했고, 그 사진으로 이어 그리는 중이어야 한다.
    await expect.poll(() => page.evaluate(() => window.__vluuGl?.inspect().morphing ?? null)).toBe(key)
  })

  test('모프는 끝나면 스스로 사라진다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)

    await page.locator('[data-sheet] [data-photo]').first().click()
    await page.waitForURL(/\/p\//)

    await expect
      .poll(() => page.evaluate(() => window.__vluuGl?.inspect().morphing ?? null), { timeout: 4000 })
      .toBeNull()
  })

  test('텍스처가 화면 전환을 살아남는다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)
    await page.waitForTimeout(900)

    const onIndex = await page.evaluate(() => window.__vluuGl!.inspect().textures)
    expect(onIndex, '인덱스에서 텍스처를 잡고 있어야 한다').toBeGreaterThan(1)

    await page.locator('[data-sheet] [data-photo]').first().click()
    await page.waitForURL(/\/p\//)
    await page.waitForTimeout(400)

    /*
     * 상세는 인덱스 위에 겹쳐 열리므로 인덱스의 프레임들도 계속 따라다닌다(68 + 모달 1).
     * 중요한 건 풀이 이전 화면의 텍스처를 그대로 들고 있다는 것이다 —
     * 라우트마다 컨텍스트를 새로 만들면 이 숫자가 떨어지고 모프는 딛고 설 땅을 잃는다.
     */
    const onViewer = await page.evaluate(() => window.__vluuGl!.inspect())
    expect(onViewer.tracked, '모달이 열려도 인덱스는 그대로 남는다').toBeGreaterThan(1)
    expect(onViewer.solo, '모달이 열렸으면 그 한 장만 그린다').toBe(true)
    expect(onViewer.textures, '풀은 이전 화면의 텍스처를 버리지 않는다').toBe(onIndex)
  })

  test('도착한 사진은 곧바로 캔버스가 넘겨받는다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)
    await page.waitForTimeout(900)

    await page.locator('[data-sheet] [data-photo]').first().click()
    await page.waitForURL(/\/p\//)

    // 텍스처가 이미 GPU에 있으므로 인계가 즉시 일어난다. 새로 받아야 했다면 여기서 시간이 걸린다.
    // 인덱스가 뒤에 남아 있으므로 모달 안쪽으로 범위를 좁힌다.
    await expect(page.locator('[role="dialog"] [data-photo]')).toHaveAttribute(
      'data-gl-ready',
      '',
      { timeout: 1200 },
    )
  })

  test('모프가 만든 이동은 속도로 잡히지 않는다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)

    /*
     * 첫 줄의 사진을 고른다. 화면 밖의 것을 누르면 Playwright가 클릭 전에 스크롤해서
     * 넣는데, 그 스크롤이 만든 진짜 속도가 감쇠하며 모프 구간까지 흘러들어온다.
     * 그러면 모프 탓이 아닌 값을 모프 탓으로 읽게 된다.
     */
    /*
     * 여는 한 장이 첫 화면을 차지하면서 격자는 접힌 아래로 내려갔다. 먼저 화면에
     * 들여놓고, 그 스크롤이 만든 속도가 완전히 멎기를 기다린 다음에 누른다.
     */
    const target = page.locator('[data-sheet] [data-photo]').nth(1)
    await target.scrollIntoViewIfNeeded()
    await expect(target).toBeInViewport()
    await expect
      .poll(() => page.evaluate(() => Math.hypot(...window.__vluuGl!.inspect().velocity)))
      .toBe(0)

    /*
     * 속도를 엘리먼트의 이동에서 재기 시작하면서 생긴 위험이다.
     * 모프로 보간한 rect까지 속도로 치면, 그리드에서 모달로 날아가는 내내
     * 사진이 자기 이동 때문에 계속 기울고 번진다.
     */
    await target.click()

    let peak = 0
    for (let i = 0; i < 12; i++) {
      const v = await page.evaluate(() => {
        const s = window.__vluuGl!.inspect()
        return { moving: s.morphing !== null, speed: Math.hypot(...s.velocity) }
      })
      if (v.moving) peak = Math.max(peak, v.speed)
      await page.waitForTimeout(50)
    }

    expect(peak, `모프 중에 속도 ${peak.toFixed(4)}가 잡혔다`).toBeLessThan(0.01)
  })

  test('모션을 끈 사용자에게는 모프가 없다', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')
    await page.waitForTimeout(500)

    await page.locator('[data-sheet] [data-photo]').first().click()
    await page.waitForURL(/\/p\//)

    // GL 자체가 켜지지 않으므로 모프도 없다. 화면은 그냥 바뀐다.
    expect(await page.evaluate(() => window.__vluuGl ?? null)).toBeNull()
    await expect(page.locator('[data-photo] img').first()).toHaveCSS('opacity', '1')
  })

  test('새 탭으로 여는 클릭은 모프를 일으키지 않는다', async ({ page }) => {
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)

    // 이 화면이 그대로 남는데 사진만 날아가면 전환이 아니라 오작동이다.
    await page.locator('[data-sheet] [data-photo]').first().click({ modifiers: ['Meta'] })
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => window.__vluuGl!.inspect().morphing)).toBeNull()
  })
})
