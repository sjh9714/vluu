import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { PageTransition } from '@/components/page-transition'
import { ViewerStage } from '@/components/viewer-stage'
import { PHOTO_LIST, getNeighbours, getPhoto, placeInRoute } from '@/lib/photos'

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
  /*
   * og:image는 손으로 쓰지 않는다 — 옆의 `opengraph-image.tsx`가 빌드 때 굽고 태그도 넣는다.
   * 여기에 또 쓰면 og:image가 둘이 되고, 어느 쪽이 쓰일지는 크롤러가 정한다.
   */
  return { title: photo.title, description: photo.caption }
}

export default async function PhotoPage({ params }: { params: Promise<{ slug: string }> }) {
  const photo = getPhoto((await params).slug)
  if (!photo) notFound()

  const { route, previous, next } = getNeighbours(photo.slug)

  return (
    <>
      <SiteHeader current={route?.slug} />
      <PageTransition>
      <main>
        <ViewerStage
          photo={photo}
          place={placeInRoute(photo.slug)}
          previous={previous}
          next={next}
        />
      </main>
        </PageTransition>
    </>
  )
}
