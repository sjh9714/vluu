import * as fmt from '@/lib/format'
import { CONTENT_TYPE, SIZE, photoData, renderCard } from '@/lib/og-card'
import { FRAME_TOTAL, PHOTO_LIST, frameNumber, getPhoto, getRouteOf } from '@/lib/photos'
import { frameLabel } from '@/lib/grid'

export const size = SIZE
export const contentType = CONTENT_TYPE
export const alt = 'A frame from VLUU'

/** 68장 전부 빌드 때 구워둔다. 런타임에 이미지를 만드는 서비스가 붙지 않는다. */
export function generateStaticParams() {
  return PHOTO_LIST.map((photo) => ({ slug: photo.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const photo = getPhoto((await params).slug)
  if (!photo) return renderCard({ title: 'VLUU' })

  const number = frameNumber(photo.slug)
  const route = getRouteOf(photo.slug)

  return renderCard({
    eyebrow: number ? `${frameLabel(number)} / ${frameLabel(FRAME_TOTAL)}` : route?.title,
    title: photo.title,
    lead: photo.caption,
    facts: [photo.place, photo.exif.shotDate ? fmt.date(photo.exif.shotDate) : null, route?.title],
    photo: { src: await photoData(photo.key), aspect: photo.aspect },
  })
}
