/**
 * "지금 보고 있는 프레임"을 고른다.
 *
 * 두 곳이 같은 답을 써야 한다 — 노선 도면의 현재 표시와, 손가락 기기에서 어느 사진이
 * 살아 움직일지. 둘이 각자 세면 도면은 A를 가리키는데 B가 재생되고, 그건 고장으로 보인다.
 *
 * 계산 자체는 한 줄이지만 경계가 여럿이다. 아무것도 안 보일 때, 딱 겹칠 때, 화면 밖일 때 —
 * 그래서 브라우저 없이 흔들어볼 수 있게 여기 둔다.
 */

export interface Span {
  /** 이 프레임을 가리키는 이름. 보통 photo.key. */
  readonly key: string
  /** 축 위의 시작과 끝. 가로 스트립이면 left/right, 세로 스크롤이면 top/bottom. */
  readonly start: number
  readonly end: number
}

/**
 * 기준점에 가장 가까운 프레임.
 *
 * 중심 사이의 거리로 잰다. "기준점을 품고 있는 것"으로 고르면 프레임 사이의 틈에
 * 기준점이 놓이는 순간 아무것도 안 골라져 표시가 깜빡인다.
 *
 * 동점이면 앞선 것이 이긴다 — 순서가 곧 시간순이므로, 흔들릴 때 앞으로 돌아가는 쪽이
 * 뒤로 튀는 것보다 덜 어색하다.
 */
export function nearest(spans: readonly Span[], point: number): string | null {
  let best: string | null = null
  let shortest = Infinity

  for (const span of spans) {
    const distance = Math.abs((span.start + span.end) / 2 - point)
    if (distance < shortest) {
      shortest = distance
      best = span.key
    }
  }

  return best
}

/**
 * 화면 안에 실제로 들어와 있는 것들만.
 *
 * 살아 움직이는 건 보이는 사진이어야 한다. 화면 밖 프레임이 "가장 가까운 것"으로
 * 뽑히면 아무도 못 보는 영상을 받아오게 된다.
 */
export function visible(spans: readonly Span[], from: number, to: number): Span[] {
  return spans.filter((span) => span.end > from && span.start < to)
}
