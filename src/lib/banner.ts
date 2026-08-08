import type { Photo, Route } from '#content/types'

/**
 * 인덱스를 여는 배너에 무엇이 흐르는가.
 *
 * 선택과 비율을 여기 한 곳에 둔다. 컴포넌트와 `verify:media`가 같은 답을 봐야
 * "구웠는데 안 쓰는 파일"이나 "쓰는데 안 구운 파일"이 조용히 생기지 않는다.
 */

/**
 * 3:2 — 35mm 필름의 비율.
 *
 * 이 사이트는 프레임을 자르지 않는 걸 규칙으로 지켜왔고 여기서만 깬다. 세로 사진이
 * 옆으로 흘러가는 띠는 만들 수 없기 때문이다. 그렇다면 얼마나 자를지가 문제인데,
 * 3:1까지 가면 원본의 75%를 버리고 **어떤 사진기도 만들지 않는 모양**이 되어
 * 눈이 곧바로 "잘렸다"고 안다. 3:2는 절반을 남기고, 사진으로 읽힌다.
 *
 * 굽는 쪽 크기는 `scripts/lib/image.ts`의 `BANNER`다. 둘이 같은 비율이어야 한다.
 */
export const BANNER_RATIO = 3 / 2

/**
 * 구간(=하루)마다 첫 프레임 한 장.
 *
 * 고르는 게 아니라 규칙이다 — 세 여행과 모든 날이 한 번씩 지나가고, 사진이 늘면
 * 저절로 바뀐다. 이 사이트가 아무것도 내세우지 않는다는 것과 같은 이유다.
 */
export function bannerFrames(routes: readonly Route[]): Photo[] {
  return routes.flatMap((route) => route.legs.map((leg) => leg.photos[0]).filter(Boolean) as Photo[])
}

/**
 * 가로로 잘라 구워둔 그림. 원본을 CSS로 덮으면 받은 픽셀의 절반을 버리게 된다.
 *
 * 두 폭이다 — 띠에서 사진 자리는 480 CSS px이라 보통 화면은 480이면 되고,
 * 레티나만 900을 받는다. 한 폭만 두면 모두가 900을 받아 절반을 버린다.
 */
export const BANNER_WIDTHS = [480, 900] as const

export function bannerSrcSet(photo: Photo): string {
  return BANNER_WIDTHS.map((w) => `/media/${photo.key}/banner-${w}.avif ${w}w`).join(', ')
}

export function bannerSrc(photo: Photo): string {
  return `/media/${photo.key}/banner-900.avif`
}

/** 자리 폭. CSS의 breakpoint와 같은 값이어야 브라우저가 옳은 폭을 고른다. */
export const BANNER_SIZES = '(max-width: 600px) 270px, (max-width: 900px) 360px, 480px'
