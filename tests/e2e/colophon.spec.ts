import { expect, test } from '@playwright/test'
import { getPhoto } from '../../src/lib/photos'

/**
 * Colophon의 만져보는 절.
 *
 * 이 페이지가 하는 주장은 전부 검사 가능해야 한다 — 셰이더가 사이트가 쓰는 그 셰이더인지,
 * 표의 숫자가 진짜 파일 크기인지, 슬라이더를 옮기면 정말 그 파일을 받는지.
 * 설명 페이지가 조용히 옛말을 하기 시작하면 나머지 주장도 같이 믿을 수 없게 된다.
 */

const demo = getPhoto('handrail-shadow')!

test('읽기만 하면 WebGL 컨텍스트를 만들지 않는다', async ({ page }) => {
  await page.goto('/colophon')
  await page.waitForTimeout(900)

  /*
   * Colophon은 읽는 페이지다. 스크롤해서 놀이터까지 오지 않은 사람이
   * 컨텍스트 값을 낼 이유가 없다. 정지 이미지가 아직 물러나지 않았다면 살아나지 않은 것이다.
   */
  await expect(page.locator('img[data-hidden]')).toHaveCount(0)
})

test.describe('셰이더 놀이터', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium에서만 WebGL을 켠다')

  test('화면에 들어오면 살아나고 정지 이미지가 물러난다', async ({ page }) => {
    await page.goto('/colophon')
    await page.getByRole('heading', { name: 'Drive it yourself' }).scrollIntoViewIfNeeded()

    await expect(page.locator('img[data-hidden]')).toHaveCount(1)
  })

  test('슬라이더가 실제로 그림을 바꾼다', async ({ page }) => {
    await page.goto('/colophon')
    await page.getByRole('heading', { name: 'Drive it yourself' }).scrollIntoViewIfNeeded()
    await expect(page.locator('img[data-hidden]')).toHaveCount(1)
    await page.waitForTimeout(400)

    const stage = page.locator('canvas[data-playground]')
    const velocity = page.locator('input[type="range"]').first()

    await velocity.fill('0')
    await page.waitForTimeout(250)
    const still = await stage.screenshot()

    await velocity.fill('0.25')
    await page.waitForTimeout(250)
    const moving = await stage.screenshot()

    expect(Buffer.compare(still, moving), '속도를 올려도 그림이 그대로다').not.toBe(0)
  })

  test('강도를 0으로 내리면 왜곡이 전부 사라진다', async ({ page }) => {
    await page.goto('/colophon')
    await page.getByRole('heading', { name: 'Drive it yourself' }).scrollIntoViewIfNeeded()
    await expect(page.locator('img[data-hidden]')).toHaveCount(1)
    await page.waitForTimeout(400)

    const stage = page.locator('canvas[data-playground]')
    const [velocity, intensity] = [
      page.locator('input[type="range"]').nth(0),
      page.locator('input[type="range"]').nth(1),
    ]

    // 속도가 0이면 강도와 무관하게 원본이어야 한다 — 그게 "0에서 전부 사라진다"의 뜻이다.
    await velocity.fill('0')
    await page.waitForTimeout(250)
    const base = await stage.screenshot()

    await velocity.fill('0.25')
    await intensity.fill('0')
    await page.waitForTimeout(250)
    const flattened = await stage.screenshot()

    expect(Buffer.compare(base, flattened), '강도 0인데 왜곡이 남았다').toBe(0)
  })

  test('Reset이 두 손잡이를 되돌린다', async ({ page }) => {
    await page.goto('/colophon')
    await page.getByRole('heading', { name: 'Drive it yourself' }).scrollIntoViewIfNeeded()

    await page.locator('input[type="range"]').nth(0).fill('0.2')
    await page.locator('input[type="range"]').nth(1).fill('0.3')
    await page.getByRole('button', { name: 'Reset' }).click()

    await expect(page.locator('input[type="range"]').nth(0)).toHaveValue('0')
    await expect(page.locator('input[type="range"]').nth(1)).toHaveValue('1')
  })
})

test.describe('파이프라인 사다리', () => {
  test('구워진 폭만큼 행이 있고 크기가 실제 값이다', async ({ page }) => {
    await page.goto('/colophon')
    const rows = page.locator('table').last().locator('tbody tr')
    await expect(rows).toHaveCount(demo.widths.length)

    // 폭은 매니페스트가 말하는 그대로여야 한다.
    for (const [i, width] of demo.widths.entries()) {
      await expect(rows.nth(i).locator('td').first()).toHaveText(String(width))
    }

    // 크기는 0이 아니고 폭이 커질수록 커져야 한다.
    const sizes = await rows.evaluateAll((tr) =>
      tr.map((row) => Number.parseInt(row.querySelectorAll('td')[1]!.textContent!, 10)),
    )
    expect(sizes.every((n) => n > 0), '크기를 재지 못했다').toBe(true)
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
  })

  test('슬라이더를 옮기면 그 폭의 파일을 실제로 받는다', async ({ page }) => {
    await page.goto('/colophon')
    await page.getByRole('heading', { name: 'What one photograph weighs' }).scrollIntoViewIfNeeded()

    const slider = page.locator('input[type="range"]').last()
    const shown = () =>
      page.evaluate(
        (key) =>
          [...document.querySelectorAll('img')]
            .map((img) => img.getAttribute('src') ?? '')
            .find((src) => src.includes(`/media/${key}/`) && src.endsWith('.avif')) ?? null,
        demo.key,
      )

    await slider.fill('0')
    await expect.poll(shown).toContain(`/${demo.widths[0]}.avif`)

    await slider.fill(String(demo.widths.length - 1))
    await expect.poll(shown).toContain(`/${demo.widths.at(-1)}.avif`)
  })
})
