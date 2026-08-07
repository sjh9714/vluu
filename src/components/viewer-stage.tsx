import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { Photo, Route } from '#content/types'
import * as fmt from '@/lib/format'
import { LiveFrame } from './live-frame'
import styles from './viewer-stage.module.css'

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}

/**
 * 사진 한 장과 그 사진이 아는 것 전부.
 *
 * 촬영정보는 EXIF에서 그대로 온다. 값이 없으면 줄 자체를 만들지 않는다 —
 * 'ISO —'는 정보가 아니라 빈칸이고, 이 셀렉에는 메타데이터가 통째로 지워진 프레임이 있다.
 */
export function ViewerStage({
  photo,
  route,
  previous,
  next,
}: {
  photo: Photo
  route: Route | undefined
  previous: Photo | undefined
  next: Photo | undefined
}) {
  const base = `/media/${photo.key}`
  const avif = photo.widths.map((w) => `${base}/${w}.avif ${w}w`).join(', ')
  const webp = photo.webpWidths.map((w) => `${base}/${w}.webp ${w}w`).join(', ')
  const fallbackWidth = photo.webpWidths.at(-1) ?? photo.widths.at(-1)

  return (
    <div
      className={styles.stage}
      style={{ '--frame-lqip': `url("${photo.lqip}")` } as CSSProperties}
    >
      <div className={styles.plate}>
        {/*
          박스가 사진의 비율을 그대로 갖는다. object-fit으로 레터박스를 만들면
          엘리먼트 rect와 실제 그림의 경계가 어긋나서, GL이 그 rect로 평면을 놓는 순간
          모프가 사진이 아니라 빈 여백을 향해 날아간다.
        */}
        <figure
          className={styles.plateBox}
          data-photo={photo.key}
          style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        >
          <picture>
            <source type="image/avif" srcSet={avif} sizes="(max-width: 860px) 100vw, 70vw" />
            <img
              className={styles.image}
              src={`${base}/${fallbackWidth}.webp`}
              srcSet={webp}
              sizes="(max-width: 860px) 100vw, 70vw"
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
          <LiveFrame photo={photo} />
        </figure>
      </div>

      <div className={styles.meta}>
        <h1 className={styles.title}>{photo.title}</h1>
        <p className={styles.caption}>{photo.caption}</p>

        <dl className={styles.facts}>
          <Fact label="Place" value={photo.place ?? null} />
          <Fact label="Date" value={photo.exif.shotDate ? fmt.date(photo.exif.shotDate) : null} />
          <Fact label="Time" value={fmt.time(photo.exif.shotAt)} />
          <Fact label="Camera" value={photo.exif.camera} />
          <Fact label="Exposure" value={fmt.exposureLine(photo.exif)} />
          <Fact label="Coords" value={fmt.coords(photo.exif.gps)} />
          <Fact label="Pixels" value={`${photo.width} × ${photo.height}`} />
          <Fact label="Route" value={route?.title ?? null} />
        </dl>

        <nav className={styles.moves} aria-label="Sequence">
          {previous ? (
            <Link href={`/p/${previous.slug}`} rel="prev">
              ← {previous.title}
            </Link>
          ) : (
            <span>← Start</span>
          )}
          {next ? (
            <Link href={`/p/${next.slug}`} rel="next">
              {next.title} →
            </Link>
          ) : (
            <span>End →</span>
          )}
        </nav>
      </div>
    </div>
  )
}
