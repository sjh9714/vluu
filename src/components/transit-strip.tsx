import type { Route } from '#content/types'
import * as fmt from '@/lib/format'
import { Frame } from './frame'
import styles from './transit-strip.module.css'

/**
 * 노선 하나를 역 순서대로 통과한다. 구간(=하루)이 바뀌는 자리에 세로 라벨이 선다.
 * 사진의 순서는 큐레이션이 아니라 촬영 시각이다 — 실제로 걸었던 순서 그대로다.
 */
export function TransitStrip({ route }: { route: Route }) {
  const first = route.legs[0]?.date
  const last = route.legs.at(-1)?.date

  return (
    <>
      <div className={styles.head}>
        <h1>{route.title}</h1>
        <p>{route.intro}</p>
      </div>

      <div className={styles.strip} tabIndex={0} role="region" aria-label={`${route.title} sequence`}>
        {route.legs.map((leg) => (
          <div key={leg.date} style={{ display: 'contents' }}>
            <div className={styles.legMark} aria-hidden="true">
              <span>
                <b>{fmt.date(leg.date)}</b> — {leg.title}
              </span>
            </div>
            {leg.photos.map((photo, index) => (
              <Frame
                key={photo.key}
                photo={photo}
                sizes="(max-width: 720px) 82vw, 45vh"
                priority={leg.date === first && index < 2}
                className={styles.stop}
              />
            ))}
          </div>
        ))}
      </div>

      <p className={styles.rail}>
        <span>
          {route.legs.length} legs · {route.photos.length} frames
        </span>
        <span className={styles.railLine} />
        <span>
          {first ? fmt.date(first) : null}
          {last && last !== first ? ` — ${fmt.date(last)}` : null}
        </span>
      </p>
    </>
  )
}
