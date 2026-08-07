import { expect, test } from '@playwright/test'
import { PHOTO_LIST, ROUTE_LIST } from '../../src/lib/photos'

test('홈이 뜨고 콘텐츠 레이어의 실제 수치를 보여준다', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'VLUU' })).toBeVisible()
  // 문구가 아니라 수치를 본다 — 파이프라인이 앱까지 이어졌는지가 확인하려는 것이다.
  await expect(page.getByText(`Frames ${PHOTO_LIST.length}`)).toBeVisible()
  await expect(page.getByText(`Routes ${ROUTE_LIST.length}`)).toBeVisible()
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
