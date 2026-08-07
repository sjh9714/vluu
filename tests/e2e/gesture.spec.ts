import { expect, test, type Locator, type Page } from '@playwright/test'
import { ROUTE_LIST } from '../../src/lib/photos'

/**
 * 손가락으로 사진 넘기고 닫기.
 *
 * 지금까지 폰에서 사진을 넘기려면 32px짜리 `‹ ›`를 정확히 눌러야 했다.
 * 여기서 검사하는 건 **손가락이 그 버튼을 대신하는가**와, 그러면서 마우스 쪽은
 * 아무것도 바뀌지 않았는가다.
 */

const dialog = '[role="dialog"]'
const route = ROUTE_LIST.find((r) => r.photos.length >= 3)!

/**
 * 통과선을 넘는 거리. 제품이 화면 크기의 비율로 판정하므로 테스트도 그래야 한다 —
 * 고정 px로 쓰면 좁은 화면에서만 통과하고 넓은 화면에서는 임계값 아래로 떨어진다.
 * 실제로 220px가 393 화면에서는 통과하고 1280에서는 통과하지 못했다.
 */
const past = (page: Page, axis: 'x' | 'y') =>
  page.viewportSize()![axis === 'x' ? 'width' : 'height'] * 0.45

/**
 * 진짜 손가락처럼 끈다.
 *
 * Playwright에는 스와이프가 없고 모바일 WebKit에는 휠도 없다. 그래서 포인터 이벤트를
 * 직접 만든다 — 제품 코드가 듣는 것이 정확히 이 이벤트들이므로, 우회로가 아니라
 * 같은 문으로 들어가는 것이다.
 */
async function swipe(
  target: Locator,
  { dx, dy, steps = 8, ms = 300 }: { dx: number; dy: number; steps?: number; ms?: number },
) {
  const box = (await target.boundingBox())!
  const x0 = box.x + box.width / 2
  const y0 = box.y + box.height / 2
  const common = { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true }

  await target.dispatchEvent('pointerdown', { ...common, clientX: x0, clientY: y0 })
  for (let i = 1; i <= steps; i += 1) {
    await target.dispatchEvent('pointermove', {
      ...common,
      clientX: x0 + (dx * i) / steps,
      clientY: y0 + (dy * i) / steps,
    })
    await target.page().waitForTimeout(ms / steps)
  }
  await target.dispatchEvent('pointerup', { ...common, clientX: x0 + dx, clientY: y0 + dy })
}

async function openFirst(page: Page) {
  await page.goto(`/c/${route.slug}`)
  await page.locator('[data-photo]').first().click()
  await expect(page.locator(dialog)).toBeVisible()
  await expect(page.locator(dialog)).toBeFocused()
  return page.locator(`${dialog} [data-photo]`)
}

test('옆으로 밀면 다음 사진으로 간다', async ({ page }) => {
  const photo = await openFirst(page)
  const second = route.photos[1]!

  // 왼쪽으로 — 종이를 넘기는 방향.
  await swipe(photo, { dx: -past(page, 'x'), dy: 0 })

  await expect(page).toHaveURL(new RegExp(`/p/${second.slug}$`))
  await expect(page.getByRole('dialog', { name: second.title })).toBeVisible()
})

test('반대로 밀면 되돌아온다', async ({ page }) => {
  const photo = await openFirst(page)
  const [first, second] = route.photos

  await swipe(photo, { dx: -past(page, 'x'), dy: 0 })
  await expect(page.getByRole('dialog', { name: second!.title })).toBeVisible()

  await swipe(page.locator(`${dialog} [data-photo]`), { dx: past(page, 'x'), dy: 0 })
  await expect(page.getByRole('dialog', { name: first!.title })).toBeVisible()
})

test('노선의 첫 장에서 뒤로 밀어도 벗어나지 않는다', async ({ page }) => {
  const photo = await openFirst(page)
  const first = route.photos[0]!

  await swipe(photo, { dx: past(page, 'x'), dy: 0 })

  // 앞이 없으면 아무 일도 없어야 한다. 다른 노선으로 새면 순서가 거짓말이 된다.
  await expect(page.getByRole('dialog', { name: first.title })).toBeVisible()
})

test('아래로 당기면 닫힌다', async ({ page }) => {
  const photo = await openFirst(page)

  await swipe(photo, { dx: 0, dy: past(page, 'y') })

  await expect(page.locator(dialog)).toHaveCount(0)
  await expect(page).toHaveURL(new RegExp(`/c/${route.slug}$`))
})

test('위로 올리는 건 아무 뜻도 없다', async ({ page }) => {
  const photo = await openFirst(page)

  /*
   * 닫기를 위아래 양쪽에 걸면 사진을 자세히 보려고 조금 올린 손짓에도 닫힌다.
   * 위로는 갈 곳이 없다.
   */
  await swipe(photo, { dx: 0, dy: -past(page, 'y') })

  await expect(page.locator(dialog)).toBeVisible()
})

test('살짝 건드린 건 넘기려던 게 아니다', async ({ page }) => {
  const photo = await openFirst(page)
  const first = route.photos[0]!

  await swipe(photo, { dx: -14, dy: 6, ms: 400 })

  await expect(page.getByRole('dialog', { name: first.title })).toBeVisible()
})

test('끌다 만 사진은 제자리로 돌아온다', async ({ page }) => {
  const photo = await openFirst(page)
  const before = (await photo.boundingBox())!

  // 임계값 아래로 천천히 끌었다 놓는다.
  await swipe(photo, { dx: -40, dy: 0, ms: 600 })
  await page.waitForTimeout(500)

  const after = (await photo.boundingBox())!
  expect(Math.abs(after.x - before.x), '사진이 밀린 채로 남았다').toBeLessThan(2)
  expect(Math.abs(after.y - before.y)).toBeLessThan(2)
})

test('마우스로 끄는 것은 제스처가 아니다', async ({ page }) => {
  const photo = await openFirst(page)
  const first = route.photos[0]!
  const box = (await photo.boundingBox())!

  /*
   * 마우스 드래그는 클릭·선택과 싸우고, 데스크톱에는 이미 화살표 키와 버튼이 있다.
   * 같은 거리를 마우스로 끌었을 때 아무 일도 없어야 한다.
   */
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - past(page, 'x'), box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()

  await expect(page.getByRole('dialog', { name: first.title })).toBeVisible()
})
