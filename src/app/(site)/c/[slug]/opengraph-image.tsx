import * as fmt from '@/lib/format'
import { CONTENT_TYPE, SIZE, photoData, renderCard } from '@/lib/og-card'
import { ROUTE_LIST, getRoute } from '@/lib/photos'

export const size = SIZE
export const contentType = CONTENT_TYPE
export const alt = 'A route through VLUU'

export function generateStaticParams() {
  return ROUTE_LIST.map((route) => ({ slug: route.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const route = getRoute((await params).slug)
  if (!route) return renderCard({ title: 'VLUU' })

  const first = route.legs[0]?.date
  const last = route.legs.at(-1)?.date
  const span =
    first && last && last !== first
      ? `${fmt.date(first)} — ${fmt.date(last)}`
      : first
        ? fmt.date(first)
        : null

  // 대표는 첫 프레임이다. 고르는 게 아니라 노선이 시작하는 자리다.
  const cover = route.photos[0]

  return renderCard({
    eyebrow: 'Route',
    title: route.title,
    lead: route.intro,
    facts: [`${route.photos.length} frames`, `${route.legs.length} days`, span],
    ...(cover ? { photo: { src: await photoData(cover.key), aspect: cover.aspect } } : {}),
  })
}
