import { CONTENT_TYPE, SIZE, photoData, renderCard } from '@/lib/og-card'
import { FRAME_TOTAL, ROUTE_LIST } from '@/lib/photos'

export const size = SIZE
export const contentType = CONTENT_TYPE
export const alt = 'VLUU — a photographic index'

/**
 * 사이트 카드. 루트에 두면 자기 og:image가 없는 화면(Colophon, 404)이 전부 이걸 물려받는다.
 *
 * 한 장을 크게 얹지 않는다 — 그건 "이게 대표작"이라는 뜻이 되는데, 이 사이트의 요점은
 * 68장을 한 덩어리로 보여주는 것이다. 대신 노선마다 첫 프레임을 한 줄로 놓는다.
 * 고르는 게 아니라 규칙이라, 사진이 늘어도 손댈 일이 없다.
 */
export default async function Image() {
  const strip = await Promise.all(
    ROUTE_LIST.filter((route) => route.photos[0]).map(async (route) => ({
      src: await photoData(route.photos[0]!.key),
      aspect: route.photos[0]!.aspect,
      label: route.title,
    })),
  )

  return renderCard({
    title: 'VLUU',
    lead: 'A photographic index of transit edges, civic geometry, and the light between them.',
    facts: [`${FRAME_TOTAL} frames`, `${ROUTE_LIST.length} routes`],
    strip,
  })
}
