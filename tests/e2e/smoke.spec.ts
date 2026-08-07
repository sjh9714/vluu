import { expect, test } from '@playwright/test'

test('사이트 셸이 선다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'VLUU' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Routes' })).toBeVisible()
})

test('바닥은 순백이다 — 화이트 큐브', async ({ page }) => {
  await page.goto('/')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  expect(bg).toBe('rgb(255, 255, 255)')
})

test('키보드만으로 본문에 도달할 수 있다', async ({ page, isMobile }) => {
  // 터치 기기 WebKit에는 Tab 순회가 없다. 스킵 링크는 데스크톱 키보드 어포던스다.
  test.skip(isMobile, '모바일 WebKit은 Tab으로 포커스를 옮기지 않는다')
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
})

test('폰트가 실제로 로드된다 — 시스템 폴백으로 새지 않는다', async ({ page }) => {
  await page.goto('/')
  const families = await page.evaluate(() => ({
    display: getComputedStyle(document.body).fontFamily,
    mono: getComputedStyle(document.querySelector('nav')!).fontFamily,
  }))
  expect(families.display).toContain('Archivo')
  expect(families.mono).toContain('Mono')
})
