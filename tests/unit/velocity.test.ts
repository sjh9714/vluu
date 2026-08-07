import { describe, expect, it } from 'vitest'
import {
  MAX_DELTA_MS,
  MAX_SPEED,
  MIN_DELTA_MS,
  REFERENCE_FRAME_MS,
  REST,
  advance,
  clampSpeed,
  frameDelta,
  perFrame,
} from '../../src/gl/velocity'

/**
 * 이 파일이 막는 건 하나다 — **프레임률에 따라 왜곡의 크기가 달라지는 것.**
 *
 * 눈으로는 "사진이 이유 없이 떤다"로만 보이고, 스크린샷으로도 안 잡힌다.
 * 실제로 그 상태로 배포까지 갔었다.
 */

const VIEWPORT = 1280
/** 손으로 굴리는 속도. 화면 크기와 무관하게 물리적으로 같은 속도다. */
const PX_PER_MS = 0.9

/** 주어진 프레임 간격들을 같은 물리 속도로 통과시켰을 때의 속도 계열. */
function run(deltas: number[]): number[] {
  let velocity = 0
  return deltas.map((dt) => {
    const moved = (PX_PER_MS * dt) / VIEWPORT
    velocity = advance(velocity, perFrame(moved, dt), dt)
    return velocity
  })
}

const settled = (deltas: number[]) => run(deltas).at(-1)!

describe('perFrame', () => {
  it('같은 물리 속도라면 프레임 간격이 달라도 같은 값이 된다', () => {
    const at = (dt: number) => perFrame((PX_PER_MS * dt) / VIEWPORT, dt)
    // 8ms(120Hz)든 40ms(25Hz)든, 초당 900px는 초당 900px이다.
    expect(at(8)).toBeCloseTo(at(40), 12)
    expect(at(16.667)).toBeCloseTo(at(8), 12)
  })

  it('기준 프레임에서는 값을 그대로 둔다', () => {
    expect(perFrame(0.02, REFERENCE_FRAME_MS)).toBeCloseTo(0.02, 12)
  })
})

describe('advance', () => {
  it('프레임률이 달라도 같은 속도로 수렴한다', () => {
    const fast = settled(Array(200).fill(8))
    const slow = settled(Array(200).fill(40))
    // 고치기 전에는 느린 쪽이 5배였다. 그게 모바일에서 왜곡이 커 보이던 이유다.
    expect(fast).toBeCloseTo(slow, 6)
  })

  it('프레임 하나가 늘어져도 다음 프레임이 튀지 않는다', () => {
    const steady = settled(Array(120).fill(8.3))

    // 8.3ms로 안정된 뒤, 41.6ms짜리 프레임 하나가 끼어든다.
    const jolted = run([...Array(120).fill(8.3), 41.6, 8.3])
    const after = jolted.at(-1)!

    // 실측된 회귀: 여기서 +22%가 튀었다.
    expect(Math.abs(after - steady) / steady).toBeLessThan(0.02)
  })

  it('목표가 0이면 0까지 내려가 정확히 멎는다', () => {
    let velocity = 0.04
    for (let i = 0; i < 300; i += 1) velocity = advance(velocity, 0, 16.667)
    // 0에 가까운 값이 아니라 0이어야 한다. 안 그러면 미세한 떨림이 영원히 남는다.
    expect(velocity).toBe(0)
  })

  it('멎기 직전의 값은 REST 밖으로 새지 않는다', () => {
    expect(Math.abs(advance(REST * 1.05, 0, 16.667))).toBe(0)
  })
})

describe('frameDelta', () => {
  it('첫 프레임은 기준 프레임으로 본다', () => {
    expect(frameDelta(1234, 0)).toBe(REFERENCE_FRAME_MS)
  })

  it('탭이 백그라운드에 있다 돌아온 몇 초를 한 프레임에 받지 않는다', () => {
    expect(frameDelta(5000, 0.1)).toBe(MAX_DELTA_MS)
  })

  it('0에 가까운 간격으로 나누지 않는다', () => {
    // perFrame이 elapsed로 나누므로, 여기가 뚫리면 속도가 무한대로 튄다.
    expect(frameDelta(100.05, 100)).toBe(MIN_DELTA_MS)
  })
})

describe('clampSpeed', () => {
  it('상한 아래는 건드리지 않는다', () => {
    expect(clampSpeed(0.01, -0.02)).toEqual({ x: 0.01, y: -0.02 })
  })

  it('길이만 자르고 방향은 지킨다', () => {
    // 축마다 자르면 대각선 움직임이 45도에서 꺾인다.
    const out = clampSpeed(0.3, 0.4)
    expect(Math.hypot(out.x, out.y)).toBeCloseTo(MAX_SPEED, 10)
    expect(out.y / out.x).toBeCloseTo(4 / 3, 10)
  })

  it('0은 0으로 둔다', () => {
    expect(clampSpeed(0, 0)).toEqual({ x: 0, y: 0 })
  })
})
