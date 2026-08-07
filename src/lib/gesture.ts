/**
 * 손가락이 무엇을 뜻하는지 읽는다.
 *
 * 모달에서 사진을 넘기려면 지금까지 작은 `‹ ›` 버튼을 눌러야 했다. 폰에서 그건
 * 사진을 넘기는 방법이 아니다 — 손가락으로 밀거나, 아래로 당겨 닫는 게 그 방법이다.
 *
 * 판정과 따라오는 양을 전부 순수 함수로 둔다. 임계값은 감으로 정하는 값이라
 * 브라우저 없이 흔들어볼 수 있어야 자신 있게 만질 수 있다.
 */

export interface Drag {
  /** 시작점에서 지금(또는 끝)까지. 화면 좌표계 — 오른쪽·아래가 양수. */
  readonly dx: number
  readonly dy: number
  /** 시작부터 경과한 시간(ms). 속도로 통과시키는 데 쓴다. */
  readonly ms: number
}

export interface Frame {
  readonly width: number
  readonly height: number
}

export type Gesture = 'prev' | 'next' | 'close' | null

/** 탭과 구분하는 최소 이동. 이보다 짧으면 손가락이 흔들린 것이다. */
const MIN_TRAVEL = 24
/** 거리로 통과하는 선. 화면 크기에 대한 비율이라 폰과 태블릿에서 같은 느낌이 된다. */
const SWIPE_RATIO = 0.18
const PULL_RATIO = 0.16
/** 속도로 통과하는 선(px/ms). 짧고 빠른 튕김도 넘어가야 한다. */
const FLICK = 0.5

/**
 * 손을 뗐을 때 무엇을 할지.
 *
 * 축은 더 크게 움직인 쪽이 이긴다 — 대각선으로 끌면 사람이 의도한 쪽은 대개 그쪽이다.
 * 위로 올리는 건 아무 뜻도 없다. 닫기를 위아래 양쪽에 걸면 사진을 자세히 보려고
 * 조금 올린 손짓에도 닫힌다.
 */
export function readGesture(drag: Drag, frame: Frame): Gesture {
  const { dx, dy, ms } = drag
  const horizontal = Math.abs(dx) > Math.abs(dy)
  const travel = horizontal ? Math.abs(dx) : Math.abs(dy)
  if (travel < MIN_TRAVEL) return null

  // ms가 0이면 속도가 무한대가 된다. 합성 이벤트에서 실제로 일어난다.
  const speed = ms > 0 ? travel / ms : Infinity

  if (horizontal) {
    const passed = Math.abs(dx) > frame.width * SWIPE_RATIO || speed > FLICK
    if (!passed) return null
    // 오른쪽으로 밀면 앞의 사진이 따라 들어온다 — 종이를 넘기는 방향 그대로다.
    return dx > 0 ? 'prev' : 'next'
  }

  if (dy <= 0) return null
  return dy > frame.height * PULL_RATIO || speed > FLICK ? 'close' : null
}

export interface Follow {
  /** 사진이 지금 얼마나 밀려 있는지(px). */
  readonly x: number
  readonly y: number
  /** 베일의 불투명도. 아래로 당길수록 옅어져 뒤 인덱스가 비친다. */
  readonly veil: number
}

/**
 * 끄는 동안 사진이 손을 따라오는 양.
 *
 * 그대로 따라오게 두지 않는다 — 가로는 넘길지 말지 아직 모르는 상태라 저항을 크게 주고,
 * 아래로 당기는 건 닫겠다는 뜻이 분명하므로 거의 그대로 따라온다. 위로는 갈 곳이 없어서
 * 고무줄처럼만 늘어난다.
 */
export function follow(drag: Drag, frame: Frame): Follow {
  const down = Math.max(0, drag.dy)
  return {
    x: drag.dx * 0.35,
    y: drag.dy > 0 ? drag.dy * 0.85 : drag.dy * 0.15,
    // 절반쯤 내려오면 0.25까지. 완전히 투명해지면 닫기 전에 이미 닫힌 것처럼 보인다.
    veil: Math.max(0.25, 1 - down / Math.max(1, frame.height * 0.5)),
  }
}
