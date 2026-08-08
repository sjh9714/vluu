import type { CSSProperties } from 'react'
import type { Photo } from '#content/types'
import * as fmt from '@/lib/format'
import { frameLabel } from '@/lib/grid'
import { FRAME_TOTAL, frameNumber, type Place } from '@/lib/photos'
import { LiveFrame } from './live-frame'
import { PhotoPicture } from './photo-picture'
import { ViewerRail } from './viewer-rail'
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
  place,
  previous,
  next,
}: {
  photo: Photo
  /**
   * 앞뒤 링크가 도는 수열에서의 자리. 아래 `Frame` 줄의 카탈로그 번호와는 다른 것이고,
   * 노선 이름도 여기서 나온다.
   */
  place: Place | undefined
  previous: Photo | undefined
  next: Photo | undefined
}) {
  const number = frameNumber(photo.slug)

  return (
    <div
      className={styles.stage}
      // 모달과 같은 이유로 여기서도 사진은 가만히 있는다.
      data-gl-still=""
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
          <PhotoPicture
            photo={photo}
            sizes="(max-width: 860px) 100vw, 70vw"
            className={styles.image}
            priority
          />
          <LiveFrame photo={photo} />
        </figure>
      </div>

      <div className={styles.meta}>
        <h1 className={styles.title}>{photo.title}</h1>
        <p className={styles.caption}>{photo.caption}</p>

        <dl className={styles.facts}>
          <Fact label="Frame" value={number ? `${frameLabel(number)} / ${frameLabel(FRAME_TOTAL)}` : null} />
          <Fact label="Place" value={photo.place ?? null} />
          <Fact label="Date" value={photo.exif.shotDate ? fmt.date(photo.exif.shotDate) : null} />
          <Fact label="Time" value={fmt.time(photo.exif.shotAt)} />
          <Fact label="Camera" value={photo.exif.camera} />
          <Fact label="Exposure" value={fmt.exposureLine(photo.exif)} />
          <Fact label="Coords" value={fmt.coords(photo.exif.gps)} />
          <Fact label="Pixels" value={`${photo.width} × ${photo.height}`} />
          {/* 노선 이름은 바로 아래 레일이 말한다. 두 줄 걸러 같은 낱말을 두 번 쓸 이유가 없다. */}
        </dl>

        {/*
          여기만 next/link가 아니라 평범한 <a>다.

          `@modal` 슬롯은 목적지가 `/p/[slug]`인 **모든 소프트 내비게이션**을 가로챈다.
          출발지가 어디인지, 라우트 그룹이 다른지는 상관없다. 그래서 이 페이지에서
          next/link로 다음 사진에 가면 전체 페이지 위에 모달이 또 열려 뷰어가 두 겹이 된다.

          이 페이지는 공유 링크로 열리는 자리다. 여기서 이동한 결과도 공유 가능한
          전체 페이지여야 하므로, 문서 이동이 의미상으로도 맞다.
        */}
        {/*
          앞뒤 링크 바로 위. `Frame 002 / 068`은 위 촬영정보에 그대로 있는데 그건 카탈로그
          번호이고, 아래 링크가 도는 건 노선이다. 둘을 붙여놓으면 "68장 중 2번째"와
          "End →"가 나란히 서서 서로를 부정한다 — 실제로 그랬다.
        */}
        <ViewerRail place={place} />

        <nav className={styles.moves} aria-label="Sequence">
          {previous ? (
            <a href={`/p/${previous.slug}`} rel="prev">
              ← {previous.title}
            </a>
          ) : (
            <span>← Start</span>
          )}
          {next ? (
            <a href={`/p/${next.slug}`} rel="next">
              {next.title} →
            </a>
          ) : (
            <span>End →</span>
          )}
        </nav>
      </div>
    </div>
  )
}
