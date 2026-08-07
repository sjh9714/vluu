import Link from 'next/link'
import type { Route } from '#content/types'
import * as fmt from '@/lib/format'
import { bounds, formatKm, niceStep, sheet, type LatLon } from '@/lib/geo'
import { BOX, PAD, basemapSrc, gps, plotCells, type PlotCell } from '@/lib/plot-cells'
import { ATTRIBUTION } from '@/lib/attribution'
import styles from './route-plot.module.css'

/**
 * 노선을 실제 지도 위에 그린 도면.
 *
 * **지도는 미리 구워둔 그림 한 장이다.** 방문자에게는 `<img>`만 가고 지도 라이브러리도
 * 타일 요청도 없다 — 이 사이트가 "붙어 있는 외부 서비스 0"을 지키는 방식이다.
 * 굽는 일은 `pnpm basemaps`가 한다.
 *
 * 처음엔 좌표만으로 그렸다. 흰 화면에 지도 타일을 얹으면 사이트가 달라진다는 이유였는데,
 * 그 대가로 **지리를 이미 아는 사람에게만 읽히는 그림**이 됐다. 대가가 더 컸다.
 *
 * **하루씩 따로 그린다.** 간토를 한 장에 그렸더니 하코네 왕복 70km가 축척을 지배해서
 * 도쿄에서 찍은 38장이 한구석에 뭉쳤다. 축척이 정직한 도면은 가장 먼 점이 나머지를 누른다.
 *
 * **접근성**: SVG는 aria-hidden이고 점들은 탭 순서에서 빠져 있다. 여기 있는 링크는
 * 전부 바로 위 스트립에 이미 있는 것이라, 키보드 사용자에게 같은 68개를 두 번
 * 지나가게 하는 값이 도면이 주는 값보다 크다. 도면이 말하는 내용은 글로도 옆에 있다.
 */

/** 표식 크기. 3:4 — 이 사이트의 프레임이 전부 그 비율이다. */
const MARK = { w: 7, h: 9 }

export function RoutePlot({ route }: { route: Route }) {
  const located = route.photos.filter((p) => gps(p))
  if (located.length === 0) return null

  const box = bounds(located.map((p) => gps(p)!))!
  const missing = route.photos.length - located.length
  /** 좌표가 두 자리 이상인가. 강화는 아니다 — 두 장이 같은 자리에서 찍혔다. */
  const spread = box.widthKm > 0 || box.heightKm > 0
  const cells = plotCells(route)

  return (
    <section className={styles.plot} data-route-plot={route.slug} aria-labelledby={`plot-${route.slug}`}>
      <div className={styles.head}>
        <h2 id={`plot-${route.slug}`}>Where</h2>
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
        {cells.map((cell) => (
          <Cell key={cell.id} cell={cell} numbered={cell.mark === 'All'} />
        ))}
      </ol>

      {/* 타일 라이선스가 요구하는 표기. 지도를 쓰는 대가이므로 화면에 있어야 한다. */}
      <p className={styles.credit}>{ATTRIBUTION}</p>
    </section>
  )
}

/**
 * 한 칸 — 지도, 그 위의 점과 선, 그 아래 두 줄.
 *
 * 축척 숫자는 **SVG 밖의 글로 둔다.** 안에 넣으면 칸이 좁아질 때 같이 줄어들어
 * 폰에서 5px짜리 글자가 된다. 막대는 그림이라 줄어도 뜻이 남지만 숫자는 아니다.
 */
function Cell({ cell, numbered }: { cell: PlotCell; numbered: boolean }) {
  /*
   * 지도와 점이 **같은 계산**에서 나와야 한다. sheet()가 점의 자리와 상자가 덮는
   * 지리 범위를 함께 내고, `pnpm basemaps`가 그 범위 그대로 지도를 굽는다.
   * 둘이 갈라지는 순간 사진이 지도의 엉뚱한 곳에 찍힌다.
   */
  const plan = sheet(cell.photos.map((p) => gps(p) as LatLon), BOX.w, BOX.h, PAD)

  const at = new Map<string, { x: number; y: number }>()
  cell.photos.forEach((photo, i) => at.set(photo.key, plan.points[i]!))

  const step = niceStep(BOX.w * plan.kmPerPx)
  const bar = step / plan.kmPerPx

  return (
    <li className={styles.cell}>
      <div className={styles.plate} style={{ aspectRatio: `${BOX.w} / ${BOX.h}` }}>
        <img
          className={styles.map}
          src={basemapSrc(cell)}
          alt=""
          width={BOX.w * 2}
          height={BOX.h * 2}
          loading="lazy"
          decoding="async"
        />

        <svg
          className={styles.canvas}
          viewBox={`0 0 ${BOX.w} ${BOX.h}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {/* 하루마다 따로 잇는다. 날 사이는 잇지 않는다 — 그 사이는 이동이 아니라 밤이다. */}
          {plan.degenerate
            ? null
            : cell.groups.map((group, i) =>
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
            ? cell.groups.map((group, i) => {
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

          {cell.photos.map((photo) => {
            const p = at.get(photo.key)!
            return (
              /*
               * 점을 누르면 그 사진이 열린다. 스트립의 프레임을 눌렀을 때와 똑같이 —
               * 인터셉트가 걸려 모달로 뜨므로 도면을 떠나지 않는다.
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

          {/* 막대만. 이게 몇 km인지는 칸 아래 글에 있다 — 거기서는 줄어들어도 읽힌다. */}
          {step > 0 ? (
            <g transform={`translate(${PAD} ${BOX.h - 12})`}>
              <line className={styles.tick} x1={0} y1={0} x2={bar} y2={0} />
              <line className={styles.tick} x1={0} y1={-4} x2={0} y2={4} />
              <line className={styles.tick} x1={bar} y1={-4} x2={bar} y2={4} />
            </g>
          ) : null}
        </svg>
      </div>

      <p className={styles.label}>
        <b>{cell.mark}</b>
        <span className={styles.title}>{cell.title}</span>
        <span className={styles.count}>{cell.photos.length}</span>
      </p>
      <p className={styles.foot}>
        {cell.date ? <span>{fmt.date(cell.date)}</span> : null}
        <span>{step > 0 ? formatKm(step) : ''}</span>
      </p>
    </li>
  )
}
