import { expect, test } from '@playwright/test'

/**
 * 인덱스를 여는 띠.
 *
 * 여기서 검사하는 건 "흐르는가"가 아니라 **흐르는 대가로 무엇을 내주지 않았는가**다.
 * 자동으로 움직이는 내용은 멈출 수 있어야 하고(WCAG 2.2.2), 이어 붙인 사본이
 * 보조기기에 같은 사진을 두 번 읽어주면 안 되고, 배너가 카탈로그를 바꿔서도 안 된다.
 */

/** 구간(=하루)마다 첫 프레임 한 장. 목록 한 벌의 길이. */
const PER_RUN = 9

test('구간마다 한 장씩, 두 벌이 같은 목록이다', async ({ page }) => {
  await page.goto('/')

  const runs = await page.evaluate(() =>
    [...document.querySelectorAll('[data-banner] ul')].map((ul) =>
      [...ul.querySelectorAll<HTMLElement>('[data-banner-key]')].map((n) => n.dataset['bannerKey']!),
    ),
  )

  expect(runs.length, '이어 붙인 두 벌이 아니다').toBe(2)
  expect(runs[0]).toHaveLength(PER_RUN)
  /*
   * 두 벌이 **정확히 같아야** `-50%`에서 시작점과 같은 그림이 되어 이음매가 안 보인다.
   * 한 장이라도 다르면 한 바퀴마다 그림이 튄다.
   */
  expect(runs[1], '두 벌이 달라서 이음매가 보인다').toEqual(runs[0])
})

test('커서를 올리면 멈추고 떼면 다시 흐른다', async ({ page }) => {
  await page.goto('/')

  const state = () =>
    page.evaluate(
      () => document.querySelector('[data-banner] ul')!.parentElement!.getAnimations()[0]?.playState,
    )

  expect(await state(), '띠가 처음부터 안 흐른다').toBe('running')

  /*
   * `hover()`가 아니라 좌표로 옮긴다. Playwright는 대상이 **멈출 때까지** 기다렸다
   * 누르는데 이 띠는 커서를 올려야 멈추므로, 사진을 집으면 영원히 기다린다.
   * 띠 자체는 제자리에 있으니 거기를 잡는다.
   */
  const box = (await page.locator('[data-banner]').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect.poll(state, { timeout: 2000 }).toBe('paused')

  // 띠 밖으로. 사진을 읽는 동안만 멈춰야지, 한 번 멈추고 끝나면 안 된다.
  await page.mouse.move(0, 0)
  await expect.poll(state, { timeout: 2000 }).toBe('running')
})

test('키보드로 들어와도 멈춘다', async ({ page }) => {
  await page.goto('/')

  /* 흘러가는 링크는 누를 수가 없다. 포커스가 들어오면 멈춰야 한다. */
  await page.locator('[data-banner] a').first().focus()
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector('[data-banner] ul')!.parentElement!.getAnimations()[0]?.playState,
      ),
    )
    .toBe('paused')
})

test('이어 붙인 사본은 보조기기에서 감춰진다', async ({ page }) => {
  await page.goto('/')

  const copies = await page.evaluate(() =>
    [...document.querySelectorAll('[data-banner] ul')].map((ul) => ({
      hidden: ul.getAttribute('aria-hidden') === 'true',
      tabbable: [...ul.querySelectorAll('a')].filter((a) => a.tabIndex >= 0).length,
    })),
  )

  expect(copies[0]!.hidden, '첫 벌까지 감췄다 — 그러면 띠를 아예 못 읽는다').toBe(false)
  expect(copies[1]!.hidden, '사본이 안 감춰져서 같은 사진을 두 번 읽어준다').toBe(true)
  expect(copies[0]!.tabbable).toBe(PER_RUN)
  expect(copies[1]!.tabbable, '사본이 탭 순서에 남아 아홉 번을 더 지나가야 한다').toBe(0)
})

test('모션을 끄면 흐르지 않고, 대신 굴릴 수 있다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const still = await page.evaluate(() => {
    const track = document.querySelector('[data-banner] ul')!.parentElement!
    return {
      animations: track.getAnimations().length,
      /* 멈춰 있다고 아홉 장 중 세 장만 볼 수 있으면 그건 내용을 잃는 것이다. */
      overflow: getComputedStyle(track.parentElement!).overflowX,
    }
  })

  expect(still.animations, '모션을 껐는데도 흐른다').toBe(0)
  expect(still.overflow).toBe('auto')
})

test('배너는 카탈로그를 바꾸지 않는다', async ({ page }) => {
  await page.goto('/')

  /*
   * 띠의 사진은 일부러 `[data-photo]`가 아니다. GL이 붙으면 매 프레임 자리가 바뀌는 걸
   * 속도로 읽어 흐르는 내내 왜곡이 걸린다.
   */
  const count = await page.evaluate(() => ({
    grid: document.querySelectorAll('[data-sheet] [data-photo]').length,
    tracked: document.querySelectorAll('[data-photo]').length,
    inBanner: document.querySelectorAll('[data-banner] [data-photo]').length,
  }))

  expect(count.inBanner, '띠의 사진이 GL 추적 대상이 됐다').toBe(0)
  expect(count.tracked).toBe(count.grid)
})
