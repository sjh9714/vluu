import { afterEach, describe, expect, it } from 'vitest'
import { siteUrl } from '../../src/lib/site-url'

/**
 * 절대 주소는 틀려도 화면에서 보이지 않는다 — sitemap과 OG 카드에만 나타난다.
 * 배포본이 localhost를 가리켜도 사이트는 멀쩡히 도는 게 이 값의 위험한 점이라,
 * 폴백 순서를 테스트로 못박아 둔다.
 */

const KEYS = ['NEXT_PUBLIC_SITE_URL', 'VERCEL_PROJECT_PRODUCTION_URL'] as const
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]))

function only(env: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const key of KEYS) {
    const value = env[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

afterEach(() => {
  for (const key of KEYS) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('siteUrl', () => {
  it('명시한 값이 Vercel이 준 값을 이긴다', () => {
    only({
      NEXT_PUBLIC_SITE_URL: 'https://vluu.example',
      VERCEL_PROJECT_PRODUCTION_URL: 'vluu.vercel.app',
    })
    expect(siteUrl()).toBe('https://vluu.example')
  })

  it('명시한 값이 없으면 Vercel 프로덕션 호스트에 https를 붙인다', () => {
    only({ VERCEL_PROJECT_PRODUCTION_URL: 'vluu.vercel.app' })
    expect(siteUrl()).toBe('https://vluu.vercel.app')
  })

  it('둘 다 없으면 dev 포트로 떨어진다', () => {
    only({})
    expect(siteUrl()).toBe('http://localhost:4321')
  })

  it('끝의 슬래시를 떼어 주소가 겹치지 않게 한다', () => {
    only({ NEXT_PUBLIC_SITE_URL: 'https://vluu.example/' })
    // 안 떼면 `https://vluu.example//p/slug`가 된다.
    expect(`${siteUrl()}/p/handrail-shadow`).toBe('https://vluu.example/p/handrail-shadow')
  })

  it('빈 문자열은 값이 없는 것으로 본다', () => {
    // Vercel 대시보드에서 변수를 만들고 값을 비워두면 이 상태가 된다.
    only({ NEXT_PUBLIC_SITE_URL: '', VERCEL_PROJECT_PRODUCTION_URL: 'vluu.vercel.app' })
    expect(siteUrl()).toBe('https://vluu.vercel.app')
  })
})
