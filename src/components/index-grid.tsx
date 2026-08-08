import Link from 'next/link'
import { Fragment } from 'react'
import type { Route } from '#content/types'
import * as fmt from '@/lib/format'
import { gridSizes } from '@/lib/grid'
import { frameNumber } from '@/lib/photos'
import { Frame } from './frame'
import styles from './index-grid.module.css'

/**
 * 인덱스 — 아카이브 그리드.
 *
 * 그리드는 **노선 단위로 이어진다.** 구간(=하루)마다 그리드를 끊으면 한 장짜리
 * 구간이 네 칸을 비우고, 91칸 중 23칸이 빈 채로 남는다. 반쯤 빈 행은 정돈의 반대다.
 *
 * 대신 날짜 경계는 칸 하나를 차지하는 **구분 카드**로 흐름 안에 들어간다.
 * 카드 목록 사이에 끼우는 색인 카드와 같은 물건이고, 덕분에 그리드는 끝까지
 * 빽빽하면서도 어느 날인지 계속 읽힌다 — 변화를 사진이 아니라 타이포가 만든다.
 */

/** 첫 행만 미리 받는다. 68장을 한꺼번에 물면 LCP가 무너진다. */
const EAGER_UNTIL = 5

const frames = (n: number) => `${n} ${n === 1 ? 'frame' : 'frames'}`

export function IndexGrid({ routes }: { routes: readonly Route[] }) {
  return (
    <>
      {routes.map((route) => (
        <section key={route.slug} className={styles.route}>
          {/*
            제목이 그 노선으로 들어가는 문이다.
            링크가 아니었을 때는 노선 페이지에 닿는 길이 헤더 네비 하나뿐이었고,
            거기서는 그냥 지명이라 다른 화면이 있다는 걸 알 방법이 없었다.
          */}
          <div className={styles.routeHead}>
            <h2>
              <Link href={`/c/${route.slug}`} className={styles.routeLink} transitionTypes={['nav-forward']}>
                {route.title}
              </Link>
            </h2>
            <span className={styles.count}>{frames(route.photos.length)}</span>
          </div>

          <div className={styles.sheet}>
            {route.legs.map((leg) => (
              /* Fragment다 — display:contents 래퍼를 두면 그리드 칸들이 실제로는
                 한 겹 안쪽에 들어가고, DOM을 타고 올라가는 쪽이 전부 헷갈린다. */
              <Fragment key={leg.date}>
                <div className={styles.legMark} data-leg-mark={leg.date}>
                  <span className={styles.legDate}>{fmt.date(leg.date)}</span>
                  <span className={styles.legTitle}>{leg.title}</span>
                  <span className={styles.count}>{frames(leg.photos.length)}</span>
                </div>

                {leg.photos.map((photo) => {
                  // 번호가 곧 화면에 놓이는 순서다. 렌더 중 카운터를 굴릴 이유가 없다.
                  const number = frameNumber(photo.slug)
                  return (
                    <Frame
                      key={photo.key}
                      photo={photo}
                      sizes={gridSizes()}
                      number={number}
                      priority={number !== undefined && number <= EAGER_UNTIL}
                      /*
                       * 화면에 들어올 때 앉는다. 첫 화면 프레임은 시작할 때 이미
                       * 범위를 지나쳐 있어 최종 상태다 — LCP를 건드리지 않는다.
                       */
                      className="vluu-arrive"
                    />
                  )
                })}
              </Fragment>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
