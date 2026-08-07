import { expect, test, type Page } from '@playwright/test'

/**
 * 사진이 숨쉬는 층.
 *
 * 이 사이트의 모션은 장식이 아니라 피사체에서 나온다 — 68장 중 50장이 3초짜리 영상을
 * 들고 있다. 여기서 검사하는 건 "예쁘게 움직이는가"가 아니라 **절제되는가**다:
 * 한 번에 하나만, 스치면 안 켜지고, 모션을 끈 사람에겐 아예 안 돌고,
 * 굴리는 동안에는 조용한지.
 */

const playing = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-live-playing]')]
      .map((n) => (n as HTMLElement).dataset['live'])
      .filter(Boolean),
  )

/** 화면 안에 있는 Live 프레임. 화면 밖은 커서를 올릴 수 없다. */
async function firstLive(page: Page) {
  const frame = page.locator('[data-live]').first()
  await frame.scrollIntoViewIfNeeded()
  await page.waitForTimeout(200)
  return frame
}

test('Live를 가진 프레임에만 표시가 붙는다', async ({ page }) => {
  await page.goto('/')
  const live = await page.locator('[data-live]').count()
  const all = await page.locator('[data-photo]').count()

  // 50/68. 전부 붙어 있으면 조건을 안 보고 붙인 것이고, 0이면 아예 안 붙은 것이다.
  expect(live).toBeGreaterThan(0)
  expect(live).toBeLessThan(all)
})

test.describe('커서가 있는 기기', () => {
  test.skip(({ isMobile }) => isMobile, '커서가 필요하다')

  test('머물면 살아나고, 한 번에 하나만 산다', async ({ page }) => {
    await page.goto('/')
    const frame = await firstLive(page)
    const box = (await frame.boundingBox())!

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect.poll(() => playing(page), { timeout: 4000 }).toHaveLength(1)

    // 다른 프레임으로 옮기면 앞의 것은 멎는다. 격자 전체가 움직이면 그건 소음이다.
    const second = page.locator('[data-live]').nth(1)
    await second.scrollIntoViewIfNeeded()
    const other = (await second.boundingBox())!
    const wanted = await second.getAttribute('data-live')
    await page.mouse.move(other.x + other.width / 2, other.y + other.height / 2)

    // 바뀔 때까지 기다린다. 개수만 보면 앞의 것이 아직 재생 중일 때도 통과한다.
    await expect.poll(() => playing(page), { timeout: 4000 }).toEqual([wanted])
  })

  test('스치고 지나가면 켜지 않는다', async ({ page }) => {
    await page.goto('/')
    await (await firstLive(page)).hover()
    await page.waitForTimeout(300)
    await expect.poll(() => playing(page)).toHaveLength(1)

    /*
     * 격자를 훑는 커서가 18MB를 끌어오면 안 된다. 머문 뒤에 시작한다.
     * 여기서는 문턱보다 짧게 스치고 곧바로 벗어난다.
     */
    await page.mouse.move(5, 5)
    await expect.poll(() => playing(page)).toHaveLength(0)

    const frames = page.locator('[data-live]')
    for (let i = 0; i < 4; i += 1) {
      const box = (await frames.nth(i).boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(40) // 문턱(120ms)보다 짧게
    }
    await page.mouse.move(5, 5)
    await page.waitForTimeout(300)
    expect(await playing(page), '스치고 지나간 것들이 재생됐다').toHaveLength(0)
  })

  test('벗어나면 멎고 정지 이미지로 돌아온다', async ({ page }) => {
    await page.goto('/')
    const frame = await firstLive(page)
    const box = (await frame.boundingBox())!

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await expect.poll(() => playing(page), { timeout: 4000 }).toHaveLength(1)

    await page.mouse.move(5, 5)
    await expect.poll(() => playing(page)).toHaveLength(0)
    // 영상은 DOM에서도 빠진다. 남겨두면 50개가 쌓인다.
    expect(await page.locator('video.vluu-live').count()).toBe(0)
  })

  test('재생 중인 프레임은 GL 왜곡을 받지 않는다', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium에서만 WebGL을 켠다')
    await page.goto('/')
    await expect.poll(() => page.evaluate(() => !!window.__vluuGl)).toBe(true)

    const frame = await firstLive(page)
    const box = (await frame.boundingBox())!

    /*
     * 영상은 `--z-content`라 GL 위에 그려진다. 그 밑에서 사진만 3px 밀리면
     * 정지된 영상 아래로 테두리가 어긋나 보인다. 그 프레임의 모션은 이미 영상이 맡고 있다.
     */
    await page.mouse.move(box.x + 10, box.y + box.height / 2)
    await expect.poll(() => playing(page), { timeout: 4000 }).toHaveLength(1)

    await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2, { steps: 10 })
    await page.waitForTimeout(120)
    expect(
      await page.evaluate(() => Math.hypot(...window.__vluuGl!.inspect().velocity)),
      '재생 중인데 커서 왜곡까지 걸렸다',
    ).toBe(0)
  })
})

test('모션을 끈 사람에게는 아예 돌지 않는다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const frame = await firstLive(page)
  await frame.hover().catch(() => {})
  await page.waitForTimeout(600)
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(800)

  // 약한 버전을 얹는 것도 아니다. 아무것도 재생되지 않는다.
  expect(await playing(page)).toHaveLength(0)
  expect(await page.locator('video.vluu-live').count()).toBe(0)
})

test.describe('손가락 기기', () => {
  test.skip(({ isMobile }) => !isMobile, '커서가 없는 쪽의 이야기다')

  test('굴리는 동안에는 조용하고, 멎으면 가운데가 살아난다', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(600)

    /*
     * 스크롤 중에 움직이는 것을 얹는 게 이 사이트에서 계속 문제였다.
     * 굴리는 동안에는 아무것도 재생하지 않는다.
     */
    await page.evaluate(async () => {
      for (let i = 0; i < 8; i += 1) {
        window.scrollBy(0, 260)
        await new Promise((r) => requestAnimationFrame(r))
      }
    })
    expect(await playing(page), '굴리는 중에 재생됐다').toHaveLength(0)

    // 멎으면 화면 한가운데 하나가 살아난다.
    await expect.poll(() => playing(page), { timeout: 4000 }).toHaveLength(1)

    const centred = await page.evaluate(() => {
      const frame = document.querySelector('[data-live][data-live-playing]')!
      const rect = frame.getBoundingClientRect()
      return { middle: rect.top + rect.height / 2, half: window.innerHeight / 2 }
    })
    // 가운데에 가장 가까운 것이어야 한다. 화면 밖 사진을 받아오면 안 된다.
    expect(Math.abs(centred.middle - centred.half)).toBeLessThan(centred.half)
  })
})
