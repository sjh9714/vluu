/**
 * 사이트의 절대 주소. sitemap·robots·OG 메타데이터가 전부 이 값 하나를 본다.
 *
 * 세 곳이 각자 폴백을 들고 있으면 언젠가 하나만 고쳐지고, 그러면 sitemap은 새 도메인을
 * 가리키는데 OG 이미지는 옛 도메인을 가리키는 식으로 조용히 어긋난다.
 *
 * 1. `NEXT_PUBLIC_SITE_URL` — 명시적으로 넣은 값. 커스텀 도메인은 여기로 이긴다
 * 2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel이 빌드 때 넣어주는 프로덕션 호스트.
 *    프로토콜 없이 호스트만 오므로 https를 붙인다. 배포 직후 환경변수를 넣기 전에도
 *    sitemap이 localhost를 가리키지 않게 하는 게 이 단계의 목적이다
 * 3. `http://localhost:4321` — 로컬. 이 프로젝트의 dev 포트와 같아야 한다
 *
 * 서버에서만 읽는다. `NEXT_PUBLIC_` 접두사는 이름을 바꾸지 않으려고 남겨둔 것이지
 * 클라이언트로 내보내려는 뜻이 아니다.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL
  if (explicit) return trimSlash(explicit)

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${trimSlash(vercel)}`

  return 'http://localhost:4321'
}

// 끝의 `/`는 붙는 순간 `https://x.com//p/slug` 같은 주소를 만든다.
function trimSlash(value: string): string {
  return value.replace(/\/+$/, '')
}
