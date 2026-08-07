import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Photo } from '#content/types'
import styles from './frame.module.css'

/**
 * 사진 한 장.
 *
 * AVIF가 실제 전달 경로이고 WebP는 폴백이다. `<picture>`가 그 순서를 정한다.
 * `<img>`가 WebP를 물고 있는 이유는 AVIF를 못 읽는 브라우저가 결국 여기로
 * 떨어지기 때문이고, 그런 브라우저는 2023년 이전 Safari 정도다.
 *
 * 크기는 aspect-ratio로 미리 확정한다. 이미지가 도착하기 전에 자리가 잡히므로
 * 레이아웃이 밀리지 않고(CLS 0), Phase 3의 GL이 읽을 좌표도 처음부터 정확하다.
 */
export function Frame({
  photo,
  sizes,
  priority = false,
  showCaption = true,
  className,
  style,
}: {
  photo: Photo
  sizes: string
  priority?: boolean
  showCaption?: boolean
  className?: string
  style?: CSSProperties
}) {
  const base = `/media/${photo.key}`
  const avif = photo.widths.map((w) => `${base}/${w}.avif ${w}w`).join(', ')
  const webp = photo.webpWidths.map((w) => `${base}/${w}.webp ${w}w`).join(', ')
  const fallbackWidth = photo.webpWidths.at(-1) ?? photo.widths.at(-1)

  return (
    <div
      className={className}
      style={
        {
          ...style,
          '--frame-color': photo.color,
          '--frame-lqip': `url("${photo.lqip}")`,
        } as CSSProperties
      }
    >
      <Link href={`/p/${photo.slug}`} className={styles.link} data-photo={photo.key}>
        <figure className={styles.frame} style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
          <picture>
            <source type="image/avif" srcSet={avif} sizes={sizes} />
            <img
              className={styles.image}
              src={`${base}/${fallbackWidth}.webp`}
              srcSet={webp}
              sizes={sizes}
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
            />
          </picture>
          {photo.live ? <span className={styles.live} aria-hidden="true" /> : null}
        </figure>
      </Link>

      {showCaption ? (
        <p className={styles.caption}>
          <span className={styles.title}>{photo.title}</span>
          {photo.place ? <span>{photo.place}</span> : null}
        </p>
      ) : null}
    </div>
  )
}
