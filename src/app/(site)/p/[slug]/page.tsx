import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { ViewerStage } from '@/components/viewer-stage'
import { PHOTO_LIST, getPhoto, getRouteOf } from '@/lib/photos'

export function generateStaticParams() {
  return PHOTO_LIST.map((photo) => ({ slug: photo.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const photo = getPhoto((await params).slug)
  if (!photo) return {}
  return {
    title: photo.title,
    description: photo.caption,
    openGraph: {
      title: photo.title,
      description: photo.caption,
      images: [
        {
          url: `/media/${photo.key}/1280.webp`,
          width: Math.min(1280, photo.width),
          height: Math.round((Math.min(1280, photo.width) / photo.width) * photo.height),
          alt: photo.alt,
        },
      ],
    },
  }
}

export default async function PhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const photo = getPhoto((await params).slug)
  if (!photo) notFound()

  // 앞뒤는 노선 안에서만 움직인다. 전체 목록으로 넘기면 여행이 끝나는 자리에서
  // 다른 나라로 튀어버린다.
  const route = getRouteOf(photo.slug)
  const sequence = route?.photos ?? PHOTO_LIST
  const at = sequence.findIndex((item) => item.slug === photo.slug)

  return (
    <>
      <SiteHeader current={route?.slug} />
      <main>
        <ViewerStage
          photo={photo}
          route={route}
          previous={at > 0 ? sequence[at - 1] : undefined}
          next={at >= 0 ? sequence[at + 1] : undefined}
        />
      </main>
    </>
  )
}
