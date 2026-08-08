import type { CSSProperties } from 'react'
import type { Place } from '@/lib/photos'
import { railPoints } from '@/lib/rail'
import styles from './viewer-rail.module.css'

/**
 * 뷰어에서 "지금 어디쯤".
 *
 * 노선 이름 · 구간 눈금이 박힌 선 · 노선 안에서의 자리. **오른쪽 숫자가 중요하다** —
 * 앞뒤 화살표가 실제로 도는 수열이 그것이다. 카탈로그 번호 `002 / 068`은 촬영정보에
 * 그대로 남는데, 그건 위치가 아니라 콘택트 시트의 네거티브 번호 같은 이 프레임의 이름이다.
 *
 * 노선 페이지의 레일과 같은 물건이지만 거기는 가로 스크롤 위치를 클라이언트가 실측해야
 * 하고, 여기는 답이 노선 데이터에 이미 있다. 그래서 클라이언트 JS가 0이다.
 *
 * 여기 사진은 없다 — 썸네일을 늘어놓는 필름스트립도 생각했지만 노선이 2 · 8 · 58장이라
 * 같은 장치가 세 번 다르게 실패한다. 두 장짜리 스트립은 우스꽝스럽고 쉰여덟 장은
 * 모달 바닥에 두 번째 내비게이션이 생긴다.
 */
export function ViewerRail({ place }: { place: Place | undefined }) {
  if (!place) return null

  const { progress, ticks } = railPoints(place.legCounts, place.at)

  return (
    <div className={styles.rail} data-viewer-rail="">
      <span className={styles.route}>{place.route.title}</span>

      {/*
        그래픽은 감춘다. 정보는 양옆의 글자가 이미 전부 말한다 — 눈금을 하나씩
        읽어주는 건 위치를 알려주는 게 아니라 방해다.
      */}
      <span className={styles.track} aria-hidden="true">
        <span className={styles.line} />
        {ticks.map((at) => (
          <span key={at} className={styles.tick} style={{ left: `${(at * 100).toFixed(3)}%` }} />
        ))}
        <span
          className={styles.marker}
          style={{ '--at': `${(progress * 100).toFixed(3)}%` } as CSSProperties}
          data-rail-marker=""
        />
      </span>

      <span className={styles.count} data-rail-count="">
        {place.at} / {place.of}
      </span>
    </div>
  )
}
