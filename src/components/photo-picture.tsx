import type { Photo } from '#content/types'

/**
 * 사진 하나를 그리는 `<picture>`.
 *
 * AVIF가 실제 전달 경로이고 WebP는 폴백이다. `<img>`가 WebP를 물고 있는 이유는
 * AVIF를 못 읽는 브라우저가 결국 여기로 떨어지기 때문이고, 그런 브라우저는
 * 2023년 이전 Safari 정도다.
 *
 * 이 조립이 인덱스·뷰어·모달 세 곳에서 필요하다. 각자 갖고 있으면 폭 목록이
 * 바뀔 때 한 곳만 고쳐놓고 지나가게 된다.
 */
export function PhotoPicture({
  photo,
  sizes,
  className,
  priority = false,
  eager = false,
}: {
  photo: Photo
  sizes: string
  className?: string
  /** 가장 먼저 보이는 사진에만. LCP 후보를 미리 당긴다. */
  priority?: boolean
  /** 뷰포트 밖이어도 즉시 받는다. 모달처럼 열리자마자 보여야 하는 자리. */
  eager?: boolean
}) {
  const base = `/media/${photo.key}`
  const avif = photo.widths.map((w) => `${base}/${w}.avif ${w}w`).join(', ')
  const webp = photo.webpWidths.map((w) => `${base}/${w}.webp ${w}w`).join(', ')
  const fallbackWidth = photo.webpWidths.at(-1) ?? photo.widths.at(-1)

  return (
    <picture>
      <source type="image/avif" srcSet={avif} sizes={sizes} />
      <img
        className={className}
        src={`${base}/${fallbackWidth}.webp`}
        srcSet={webp}
        sizes={sizes}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading={priority || eager ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
      />
    </picture>
  )
}
