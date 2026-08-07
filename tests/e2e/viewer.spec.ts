import { expect, test } from '@playwright/test'
import { PHOTO_LIST } from '../../src/lib/photos'

const live = PHOTO_LIST.find((photo) => photo.live)
const still = PHOTO_LIST.find((photo) => !photo.live)

test('Live Photo에는 재생 컨트롤이 있고 정지 사진에는 없다', async ({ page }) => {
  test.skip(!live || !still, 'Live 프레임과 정지 프레임이 둘 다 있어야 한다')

  await page.goto(`/p/${live!.slug}`)
  await expect(page.getByRole('button', { name: 'Live' })).toBeVisible()

  await page.goto(`/p/${still!.slug}`)
  await expect(page.getByRole('button', { name: 'Live' })).toHaveCount(0)
})

test('클라이언트 컴포넌트가 실제로 하이드레이트된다', async ({ page }) => {
  test.skip(!live, 'Live 프레임이 필요하다')
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('response', (response) => {
    if (response.url().includes('/_next/') && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`)
    }
  })

  await page.goto(`/p/${live!.slug}`)
  // 서버는 이 버튼을 그리지만, 눌러서 반응하려면 하이드레이션이 끝나야 한다.
  const button = page.getByRole('button', { name: 'Live' })
  await button.click()
  await expect(page.locator('video')).toHaveAttribute('data-playing', 'true')

  expect(errors, '_next 청크가 막히면 SSR 화면은 멀쩡한데 상호작용만 죽는다').toEqual([])
})

test('모션을 끄면 Live를 권하지 않는다', async ({ page }) => {
  test.skip(!live, 'Live 프레임이 필요하다')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`/p/${live!.slug}`)
  await expect(page.getByRole('button', { name: 'Live' })).toBeHidden()
})

test('촬영정보가 있는 사진은 노출값을 보여준다', async ({ page }) => {
  const withExif = PHOTO_LIST.find((photo) => photo.exif.iso !== null)
  test.skip(!withExif, 'EXIF가 있는 프레임이 필요하다')

  await page.goto(`/p/${withExif!.slug}`)
  await expect(page.getByText('Exposure')).toBeVisible()
  await expect(page.getByText(`ISO ${withExif!.exif.iso}`)).toBeVisible()
})

test('촬영정보가 없는 사진은 빈 줄을 만들지 않는다', async ({ page }) => {
  const noExif = PHOTO_LIST.find((photo) => photo.exif.iso === null)
  test.skip(!noExif, 'EXIF 없는 프레임이 필요하다')

  await page.goto(`/p/${noExif!.slug}`)
  await expect(page.getByText('Exposure')).toHaveCount(0)
  await expect(page.getByText('Coords')).toHaveCount(0)
  // 대신 사진이 아는 것은 그대로 보여준다.
  await expect(page.getByRole('heading', { level: 1, name: noExif!.title })).toBeVisible()
})

test('시퀀스를 앞뒤로 넘길 수 있고 노선을 벗어나지 않는다', async ({ page }) => {
  const route = PHOTO_LIST.filter((p) => p.exif.shotDate.startsWith('2025-01'))
  const middle = route[3]
  test.skip(!middle, '노선 중간 프레임이 필요하다')

  await page.goto(`/p/${middle!.slug}`)
  await page.getByRole('link', { name: /→$/ }).click()
  await expect(page.getByRole('link', { name: /^←/ })).toBeVisible()
  await page.getByRole('link', { name: /^←/ }).click()
  await expect(page).toHaveURL(new RegExp(`/p/${middle!.slug}$`))
})
