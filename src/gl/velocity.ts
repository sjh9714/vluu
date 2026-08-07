/**
 * 셰이더가 받는 속도를 만드는 계산.
 *
 * 브라우저 없이 검사할 수 있게 여기로 꺼냈다. 이 파일이 다루는 건 단 하나 —
 * **프레임이 얼마나 걸렸든 같은 움직임은 같은 값이 되어야 한다.**
 *
 * 처음엔 그렇지 않았다. 한 프레임에 움직인 픽셀을 그대로 썼기 때문에, 같은 속도로
 * 굴려도 프레임이 길어지면 왜곡이 커졌다. 실측하면 이렇게 나왔다 —
 *
 * ```
 * dt  8.6ms → 0.01240
 * dt 41.6ms → 0.01222     프레임 하나가 늘어지고
 * dt  8.3ms → 0.01508     다음 프레임에서 22% 튄다
 * ```
 *
 * 눈에는 사진이 이유 없이 떠는 것으로 보인다. 프레임이 불규칙한 모바일에서 더 심했다.
 */

/** 기준 프레임. 모든 속도는 "60fps 한 프레임에 이만큼 움직였다"로 환산된다. */
export const REFERENCE_FRAME_MS = 1000 / 60

/** 기준 프레임 한 번에 목표를 따라잡는 비율. 실제 감쇠는 경과 시간으로 환산한다. */
export const DAMP = 0.12

/** 이 속도 이하는 0으로 본다. 손을 떼고도 미세하게 떨리는 걸 막는다. */
export const REST = 0.0004

/** 탭이 백그라운드에 있다 돌아오면 delta가 몇 초씩 튄다. 그 한 프레임에 전부 날리지 않는다. */
export const MAX_DELTA_MS = 100

/** 0으로 나누는 걸 막는다. 240Hz에서도 4ms는 넘는다. */
export const MIN_DELTA_MS = 4

/**
 * 셰이더로 나가는 속도의 상한.
 *
 * 실제 스크롤이 내는 최대치가 0.04 언저리다. 커서를 화면 가로로 튕기면 한 프레임에
 * 0.5도 나오는데, 셰이더에서 상한이 걸린 건 번짐뿐이라 전단과 눌림이 무제한으로 커진다 —
 * 사진이 찢어진 것처럼 보인다.
 */
export const MAX_SPEED = 0.05

/** 한 프레임의 경과 시간. 튀는 값과 0에 가까운 값을 양쪽에서 막는다. */
export function frameDelta(now: number, previous: number): number {
  if (previous === 0) return REFERENCE_FRAME_MS
  return Math.min(Math.max(now - previous, MIN_DELTA_MS), MAX_DELTA_MS)
}

/**
 * 이번 프레임에 움직인 양을 "60fps 한 프레임이었다면 얼마였을까"로 환산한다.
 *
 * `moved`는 뷰포트 비율이다 — 픽셀이 아니라. 그래야 화면 크기가 달라도 같은 제스처가
 * 같은 왜곡을 만든다.
 */
export function perFrame(moved: number, elapsedMs: number): number {
  return moved * (REFERENCE_FRAME_MS / elapsedMs)
}

/** 목표를 향해 한 프레임 따라간다. 감쇠는 프레임 수가 아니라 경과 시간에 건다. */
export function advance(current: number, target: number, elapsedMs: number): number {
  const catchUp = 1 - (1 - DAMP) ** (elapsedMs / REFERENCE_FRAME_MS)
  const next = current + (target - current) * catchUp
  return Math.abs(next) < REST ? 0 : next
}

/** 벡터의 길이를 상한으로 자른다. 방향은 유지한다 — 축마다 자르면 대각선이 꺾인다. */
export function clampSpeed(x: number, y: number, max = MAX_SPEED): { x: number; y: number } {
  const speed = Math.hypot(x, y)
  if (speed <= max || speed === 0) return { x, y }
  const k = max / speed
  return { x: x * k, y: y * k }
}
