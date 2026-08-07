import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Photo } from '#content/types'
import { frameLabel } from '@/lib/grid'
import { date as fmtDate } from '@/lib/format'
import { PhotoPicture } from './photo-picture'
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
  number,
  priority = false,
  showCaption = true,
  className,
  style,
}: {
  photo: Photo
  sizes: string
  /** 카탈로그 번호. 있으면 캡션 맨 앞에 붙는다. */
  number?: number
  priority?: boolean
  showCaption?: boolean
  className?: string
  style?: CSSProperties
}) {
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
        <figure
          className={styles.frame}
          style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
          /*
           * Live Photo가 있는 프레임의 표시. `live-layer`가 이걸 보고 영상을 여기 넣는다.
           * 상자에 다는 이유는 aspect-ratio와 overflow:hidden이 여기 있어서다 —
           * 영상이 사진과 정확히 같은 자리에 잘려 앉는다.
           */
          data-live={photo.live ? photo.key : undefined}
        >
          <PhotoPicture photo={photo} sizes={sizes} className={styles.image} priority={priority} />
          {photo.live ? <span className={styles.live} aria-hidden="true" /> : null}
        </figure>
      </Link>

      {showCaption ? (
        /*
         * 두 줄로 고정한다. 제목 길이에 따라 줄바꿈이 갈리면 캡션 높이가 달라지고,
         * 균일 그리드가 애써 맞춰놓은 다음 행의 시작점이 어긋난다.
         */
        <p className={styles.caption}>
          <span className={styles.line}>
            {number !== undefined ? <span className={styles.number}>{frameLabel(number)}</span> : null}
            <span className={styles.title}>{photo.title}</span>
          </span>
          <span className={styles.line}>{photo.place ?? fmtDate(photo.exif.shotDate)}</span>
        </p>
      ) : null}
    </div>
  )
}
