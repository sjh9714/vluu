import Link from 'next/link'
import type { Photo, Route } from '#content/types'
import * as fmt from '@/lib/format'
import {
  bounds,
  fit,
  formatKm,
  niceStep,
  project,
  type LatLon,
} from '@/lib/geo'
import styles from './route-plot.module.css'

/**
 * 노선을 좌표 그대로 그린 도면.
 *
 * 베이스맵은 없다. 순백 큐브에 지도 타일을 얹으면 그 순간 다른 사이트가 되고,
 * 붙어 있는 외부 서비스가 0이라는 성질도 함께 사라진다. 여기 있는 건 점과 선,
 * 축척 바 — 측량 도면이 가진 것뿐이다.
 *
 * **하루씩 따로 그린다.** 처음엔 노선 전체를 한 장에 그렸는데, 간토는 하코네 왕복
 * 70km가 축척을 지배해서 도쿄에서 찍은 38장이 한구석에 뭉쳐 아무것도 읽히지 않았다.
 * 축척이 정직한 도면은 가장 먼 점이 나머지를 전부 눌러버린다. 하루가 이 사이트의
 * 구간 단위이기도 하므로, 날마다 자기 축척으로 그리고 전체는 첫 칸에 개요로 남긴다.
 *
 * 전부 서버에서 낸다. JS가 없어도 경로가 보이고, 클라이언트로는 이미 HTML 안에 있는
 * 좌표 말고 아무것도 가지 않는다.
 *
 * **접근성**: SVG는 aria-hidden이고 점들은 탭 순서에서 빠져 있다. 여기 있는 링크는
 * 전부 바로 위 스트립에 이미 있는 것이라, 키보드 사용자에게 같은 68개를 두 번
 * 지나가게 하는 값이 도면이 주는 값보다 크다. 도면이 말하는 내용은 글로도 옆에 있다.
 */

/** 모든 칸이 같은 상자를 쓴다 — 그래야 획과 표식이 칸마다 같은 크기로 보인다. */
const BOX = { w: 400, h: 300 }
const PAD = 26
/** 표식 크기. 3:4 — 이 사이트의 프레임이 전부 그 비율이다. */
const MARK = { w: 7, h: 9 }

const gps = (photo: Photo): LatLon | null => photo.exif.gps

export function RoutePlot({ route }: { route: Route }) {
  const located = route.photos.filter((p) => gps(p))
  if (located.length === 0) return null

  const box = bounds(located.map((p) => gps(p)!))!
  const missing = route.photos.length - located.length
  /** 좌표가 두 자리 이상인가. 강화는 아니다 — 두 장이 같은 자리에서 찍혔다. */
  const spread = box.widthKm > 0 || box.heightKm > 0

  const days = route.legs
    .map((leg, index) => ({ leg, number: index + 1, photos: leg.photos.filter((p) => gps(p)) }))
    .filter((day) => day.photos.length > 0)

  // 하루짜리 노선은 개요와 그 하루가 같은 그림이다. 같은 걸 두 번 그리지 않는다.
  const overview = days.length > 1

  return (
    <section className={styles.plot} data-route-plot={route.slug} aria-labelledby={`plot-${route.slug}`}>
      <div className={styles.head}>
        <h2 id={`plot-${route.slug}`}>Where</h2>
        {/*
          여행에 대한 사실만 남긴다. "북쪽이 위이고 베이스맵은 없다" 같은 건 내가 어떻게
          그렸는지에 대한 말이지 이 여행에 대한 말이 아니다 — 그건 Colophon에 있다.
        */}
        <p>
          {spread ? (
            <>
              {formatKm(box.widthKm)} east to west, {formatKm(box.heightKm)} north to south.
              {missing > 0 ? ` ${located.length} of ${route.photos.length} frames have coordinates.` : ''}
            </>
          ) : (
            <>One place — every frame here shares a coordinate.</>
          )}
        </p>
      </div>

      <ol className={styles.grid}>
        {overview ? (
          <li className={styles.cell}>
            <Plate groups={days.map((d) => d.photos)} numbered />
            <p className={styles.label}>
              <b>All</b>
              <span className={styles.title}>{days.length} days</span>
              <span className={styles.count}>{located.length}</span>
            </p>
          </li>
        ) : null}

        {days.map(({ leg, number, photos }) => (
          <li key={leg.date} className={styles.cell}>
            <Plate groups={[photos]} />
            <p className={styles.label}>
              <b>{number}</b>
              <span className={styles.title}>{leg.title}</span>
              <span className={styles.count}>{photos.length}</span>
            </p>
            <p className={styles.date}>{fmt.date(leg.date)}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * 한 칸. 무리(=하루)마다 따로 잇는다.
 *
 * 좌표가 한 자리뿐이면 선을 그리지 않는다 — 없는 이동을 그리는 것이고, 축척 바도
 * 뜻이 없다. 강화가 정확히 그 경우다.
 */
function Plate({ groups, numbered = false }: { groups: readonly (readonly Photo[])[]; numbered?: boolean }) {
  const flat = groups.flat()
  const plot = project(
    flat.map((p) => gps(p)!),
    bounds(flat.map((p) => gps(p)!))!,
  )
  const placed = fit(plot, BOX.w, BOX.h, PAD)

  const at = new Map<string, { x: number; y: number }>()
  flat.forEach((photo, i) => at.set(photo.key, placed.points[i]!))

  const step = plot.degenerate ? 0 : niceStep(plot.kmPerUnit)

  return (
    <svg
      className={styles.canvas}
      viewBox={`0 0 ${BOX.w} ${BOX.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {plot.degenerate
        ? null
        : groups.map((group, i) =>
            group.length > 1 ? (
              <polyline
                key={i}
                className={styles.path}
                points={group
                  .map((p) => `${at.get(p.key)!.x.toFixed(2)},${at.get(p.key)!.y.toFixed(2)}`)
                  .join(' ')}
              />
            ) : null,
          )}

      {numbered
        ? groups.map((group, i) => {
            const head = group[0]
            if (!head) return null
            const p = at.get(head.key)!
            return (
              <text
                key={i}
                className={styles.legNumber}
                x={p.x}
                y={p.y - MARK.h}
                textAnchor="middle"
              >
                {i + 1}
              </text>
            )
          })
        : null}

      {flat.map((photo) => {
        const p = at.get(photo.key)!
        return (
          /*
           * 점을 누르면 그 사진이 열린다. 스트립의 프레임을 눌렀을 때와 똑같이 —
           * 인터셉트가 걸려 모달로 뜨므로 도면을 떠나지 않는다.
           *
           * 처음엔 대신 스트립을 그 프레임으로 굴렸는데, 스트립이 도면 위에 있어서
           * 페이지가 400px 위로 튀었다. 보고 있던 게 화면 밖으로 나가는 게 클릭의 답일 리 없고,
           * 무엇보다 링크가 몰래 다른 걸 스크롤하면 그건 링크가 아니다.
           */
          <Link
            key={photo.key}
            className={styles.mark}
            href={`/p/${photo.slug}`}
            data-plot-key={photo.key}
            // 스트립에 같은 링크가 이미 있다. 탭 순서를 두 번 채우지 않는다.
            tabIndex={-1}
          >
            <rect x={p.x - MARK.w / 2} y={p.y - MARK.h / 2} width={MARK.w} height={MARK.h} />
          </Link>
        )
      })}

      {step > 0 ? (
        <g transform={`translate(${PAD} ${BOX.h - 10})`}>
          <line className={styles.tick} x1={0} y1={0} x2={step * placed.unitsPerKm} y2={0} />
          <line className={styles.tick} x1={0} y1={-3.5} x2={0} y2={3.5} />
          <line
            className={styles.tick}
            x1={step * placed.unitsPerKm}
            y1={-3.5}
            x2={step * placed.unitsPerKm}
            y2={3.5}
          />
          <text className={styles.scaleLabel} x={step * placed.unitsPerKm + 7} y={3.5}>
            {formatKm(step)}
          </text>
        </g>
      ) : (
        <text className={styles.scaleLabel} x={PAD} y={BOX.h - 8}>
          one place
        </text>
      )}
    </svg>
  )
}
