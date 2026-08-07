import { expect, test } from '@playwright/test'
import { PHOTO_LIST, ROUTE_LIST } from '../../src/lib/photos'

test('인덱스가 모든 프레임을 싣는다', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-photo]')).toHaveCount(PHOTO_LIST.length)
})

test('레이아웃이 밀리지 않는다 — 모든 사진이 미리 자리를 잡는다', async ({ page }) => {
  await page.goto('/')
  // 이미지가 오기 전에 자리가 확정돼야 CLS가 0이 된다. aspect-ratio가 그 역할을 한다.
  const missing = await page.evaluate(() =>
    [...document.querySelectorAll('figure')].filter(
      (el) => !getComputedStyle(el).aspectRatio || getComputedStyle(el).aspectRatio === 'auto',
    ).length,
  )
  expect(missing).toBe(0)
})

for (const route of ROUTE_LIST) {
  test(`노선 ${route.slug}가 구간과 프레임을 모두 보여준다`, async ({ page }) => {
    await page.goto(`/c/${route.slug}`)
    await expect(page.getByRole('heading', { level: 1, name: route.title })).toBeVisible()
    await expect(page.locator('[data-photo]')).toHaveCount(route.photos.length)
    await expect(page.getByText(`${route.legs.length} legs · ${route.photos.length} frames`)).toBeVisible()
  })
}

test('인덱스의 노선 제목이 그 노선으로 들어가는 문이다', async ({ page }) => {
  /*
   * 링크가 아니었을 때는 노선 페이지에 닿는 길이 헤더 네비 하나뿐이었고, 거기서는
   * 그냥 지명이라 다른 화면이 있다는 걸 알 방법이 없었다. 실제로 못 찾은 사람이 있었다.
   */
  await page.goto('/')
  const route = ROUTE_LIST[0]!
  await page.getByRole('heading', { level: 2, name: route.title }).getByRole('link').click()
  await expect(page).toHaveURL(new RegExp(`/c/${route.slug}$`))
  await expect(page.getByRole('heading', { level: 1, name: route.title })).toBeVisible()
})

test('인덱스에서 사진을 눌러 뷰어로 간다', async ({ page }) => {
  await page.goto('/')
  const first = PHOTO_LIST[0]!
  await page.locator(`[data-photo="${first.key}"]`).click()
  await expect(page).toHaveURL(new RegExp(`/p/${first.slug}$`))
  // 이제 전체 페이지가 아니라 인덱스 위에 겹쳐 열린다. 제목은 대화상자의 이름표에 있다.
  await expect(page.getByRole('dialog', { name: first.title })).toBeVisible()
})

test('Colophon의 수치는 실제 파일에서 나온다', async ({ page }) => {
  await page.goto('/colophon')

  const live = PHOTO_LIST.filter((photo) => photo.live).length
  await expect(page.getByRole('term').filter({ hasText: 'Live Photos' })).toBeVisible()
  await expect(page.getByRole('definition').filter({ hasText: String(live) }).first()).toBeVisible()

  // 굽는 포맷이 전부 표에 있어야 한다.
  for (const format of ['avif', 'webp', 'mp4']) {
    await expect(page.getByRole('cell', { name: format, exact: true })).toBeVisible()
  }

  // 용량은 빌드 때 실제로 잰 값이다. 0 MB면 재는 데 실패한 것이다.
  const shipped = await page.getByRole('definition').filter({ hasText: 'MB' }).first().innerText()
  expect(Number.parseFloat(shipped)).toBeGreaterThan(1)
})

test('없는 주소는 404로 간다', async ({ page }) => {
  const response = await page.goto('/p/does-not-exist')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1, name: 'Not on any route' })).toBeVisible()
})

test('모든 이미지가 대체텍스트를 갖는다', async ({ page }) => {
  await page.goto('/')
  const empty = await page.evaluate(
    () => [...document.querySelectorAll('img')].filter((img) => !img.alt.trim()).length,
  )
  expect(empty).toBe(0)
})
