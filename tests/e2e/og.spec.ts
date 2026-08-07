import { expect, test, type Page } from '@playwright/test'
import { PHOTO_LIST, ROUTE_LIST } from '../../src/lib/photos'

/**
 * 링크를 던졌을 때 먼저 보이는 그림.
 *
 * 이건 화면에 안 나오는 기능이라 조용히 망가진다 — 카드가 깨져도 사이트는 멀쩡하고,
 * 알아채는 건 누가 링크를 공유한 뒤다. 그래서 여기서 지켜본다.
 *
 * HTTP 응답만 보므로 브라우저 종류와 무관하다. 한 번만 돈다.
 */
test.describe('링크 미리보기 카드', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', '응답만 보므로 한 번이면 된다')

  /** HTML이 실제로 가리키는 카드 주소. 파일 이름에 해시가 붙어서 손으로 못 쓴다. */
  async function cardUrl(page: Page, path: string): Promise<string> {
    await page.goto(path)
    const urls = await page.evaluate(() =>
      [...document.querySelectorAll('meta[property="og:image"]')].map((m) =>
        m.getAttribute('content'),
      ),
    )
    // 둘이면 크롤러가 어느 쪽을 쓸지 우리가 모른다. 손으로 쓴 og:image를 지운 이유다.
    expect(urls, `${path}의 og:image가 하나가 아니다`).toHaveLength(1)
    return urls[0]!
  }

  const cases = [
    { name: '사이트', path: '/' },
    { name: '노선', path: `/c/${ROUTE_LIST[0]!.slug}` },
    { name: '사진', path: `/p/${PHOTO_LIST[0]!.slug}` },
    { name: 'Colophon', path: '/colophon' },
  ]

  for (const { name, path } of cases) {
    test(`${name} 카드가 실제로 구워져 있다`, async ({ page, request }) => {
      const url = await cardUrl(page, path)
      const res = await request.get(url)

      expect(res.status()).toBe(200)
      expect(res.headers()['content-type']).toContain('image/png')

      const body = await res.body()
      // PNG의 IHDR — 폭·높이가 바이트 16부터 빅엔디언으로 들어 있다.
      expect(body.subarray(1, 4).toString()).toBe('PNG')
      expect(body.readUInt32BE(16)).toBe(1200)
      expect(body.readUInt32BE(20)).toBe(630)
      // 흰 바탕에 글자만 있어도 이보다는 크다. 빈 카드가 조용히 나가는 걸 막는다.
      expect(body.byteLength).toBeGreaterThan(10_000)
    })
  }

  test('og:image가 없는 화면은 사이트 카드를 물려받는다', async ({ page }) => {
    // Colophon에는 자기 카드가 없다. 루트의 카드가 내려오는지 확인한다.
    expect(await cardUrl(page, '/colophon')).toBe(await cardUrl(page, '/'))
  })

  test('사진마다 다른 카드가 나간다', async ({ page }) => {
    const a = await cardUrl(page, `/p/${PHOTO_LIST[0]!.slug}`)
    const b = await cardUrl(page, `/p/${PHOTO_LIST[1]!.slug}`)
    expect(a).not.toBe(b)
    // 원본 사진을 그대로 가리키던 옛 방식으로 돌아가지 않았는지.
    expect(a).not.toContain('/media/')
    expect(a).toContain('opengraph-image')
  })

  test('노선 카드는 노선마다 다르다', async ({ page }) => {
    const urls = new Set<string>()
    for (const route of ROUTE_LIST) urls.add(await cardUrl(page, `/c/${route.slug}`))
    expect(urls.size).toBe(ROUTE_LIST.length)
  })
})
