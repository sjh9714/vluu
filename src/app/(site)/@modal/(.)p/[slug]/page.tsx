import { notFound } from 'next/navigation'
import { PhotoModal } from '@/components/photo-modal'
import {
  FRAME_TOTAL,
  PHOTO_LIST,
  frameNumber,
  getNeighbours,
  getPhoto,
  placeInRoute,
} from '@/lib/photos'

/**
 * `/p/[slug]`를 가로채 인덱스 위에 겹쳐 연다.
 *
 * `(.)`는 파일 경로가 아니라 **라우트 세그먼트** 기준이다. `(site)`는 라우트 그룹이고
 * `@modal`은 슬롯이라 둘 다 세그먼트가 아니므로, 이 파일은 `/p/[slug]`와 같은 레벨에 있다.
 *
 * 가로채기는 소프트 내비게이션에만 걸린다. 공유 링크나 새로고침에서는
 * `(site)/p/[slug]/page.tsx`가 그대로 전체 페이지로 뜬다.
 */
export function generateStaticParams() {
  // 사이트 전체가 정적이다. 모달 경로도 프리렌더되어야 클릭할 때 서버를 타지 않는다.
  return PHOTO_LIST.map((photo) => ({ slug: photo.slug }))
}

export default async function InterceptedPhoto({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const photo = getPhoto((await params).slug)
  if (!photo) notFound()

  const { previous, next } = getNeighbours(photo.slug)

  return (
    <PhotoModal
      photo={photo}
      number={frameNumber(photo.slug)}
      total={FRAME_TOTAL}
      place={placeInRoute(photo.slug)}
      previous={previous}
      next={next}
    />
  )
}
