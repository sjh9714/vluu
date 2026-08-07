import { describe, expect, it } from 'vitest'
import { follow, readGesture, type Frame } from '../../src/lib/gesture'

/**
 * 임계값은 감으로 정하는 값이다. 그래서 여기서 흔들어보고 정한다 —
 * 폰을 들고 스무 번 밀어보는 것보다 빠르고, 무엇보다 다음 사람이 바꿀 때
 * 무엇이 깨지는지 보인다.
 */

const PHONE: Frame = { width: 393, height: 852 }

describe('readGesture', () => {
  it('탭은 아무 뜻도 아니다', () => {
    // 누르는 동안 손가락은 늘 몇 px 흔들린다. 그게 사진을 넘기면 못 쓴다.
    expect(readGesture({ dx: 6, dy: 4, ms: 90 }, PHONE)).toBeNull()
    expect(readGesture({ dx: 0, dy: 0, ms: 40 }, PHONE)).toBeNull()
  })

  it('길고 느리게 밀어도 넘어간다', () => {
    // 393 × 0.18 = 71px
    expect(readGesture({ dx: -90, dy: 10, ms: 900 }, PHONE)).toBe('next')
    expect(readGesture({ dx: 90, dy: 10, ms: 900 }, PHONE)).toBe('prev')
  })

  it('짧고 빠르게 튕겨도 넘어간다', () => {
    // 40px면 거리로는 못 넘지만 속도가 1px/ms다. 손목으로 튕기는 사람이 실제로 이렇게 한다.
    expect(readGesture({ dx: -40, dy: 5, ms: 40 }, PHONE)).toBe('next')
  })

  it('어중간하게 밀다 말면 아무 일도 없다', () => {
    expect(readGesture({ dx: -45, dy: 5, ms: 600 }, PHONE)).toBeNull()
  })

  it('오른쪽이 앞, 왼쪽이 뒤 — 종이를 넘기는 방향', () => {
    expect(readGesture({ dx: 200, dy: 0, ms: 500 }, PHONE)).toBe('prev')
    expect(readGesture({ dx: -200, dy: 0, ms: 500 }, PHONE)).toBe('next')
  })

  it('대각선은 더 크게 움직인 축을 따른다', () => {
    expect(readGesture({ dx: -120, dy: 100, ms: 500 }, PHONE)).toBe('next')
    expect(readGesture({ dx: -100, dy: 200, ms: 500 }, PHONE)).toBe('close')
  })

  it('아래로 당기면 닫는다', () => {
    // 852 × 0.16 = 136px
    expect(readGesture({ dx: 10, dy: 180, ms: 700 }, PHONE)).toBe('close')
  })

  it('위로 올리는 건 아무 뜻도 없다', () => {
    /*
     * 닫기를 위아래 양쪽에 걸면, 사진을 자세히 보려고 조금 올린 손짓에도 닫힌다.
     * 위로는 갈 곳이 없다.
     */
    expect(readGesture({ dx: 0, dy: -300, ms: 500 }, PHONE)).toBeNull()
    expect(readGesture({ dx: 0, dy: -900, ms: 200 }, PHONE)).toBeNull()
  })

  it('경과 시간이 0이어도 무한대로 나누지 않는다', () => {
    // 합성 이벤트에서 실제로 일어난다. 여기가 뚫리면 아주 작은 흔들림도 튕김이 된다.
    expect(readGesture({ dx: -200, dy: 0, ms: 0 }, PHONE)).toBe('next')
    expect(readGesture({ dx: -5, dy: 0, ms: 0 }, PHONE)).toBeNull()
  })

  it('화면이 크면 같은 거리라도 덜 움직인 것이다', () => {
    const tablet: Frame = { width: 1024, height: 1366 }
    const drag = { dx: -90, dy: 0, ms: 900 }
    expect(readGesture(drag, PHONE)).toBe('next')
    // 같은 90px가 태블릿에서는 화면의 9%뿐이다. 느리게 그만큼만 밀었으면 넘기려던 게 아니다.
    expect(readGesture(drag, tablet)).toBeNull()
  })
})

describe('follow', () => {
  it('가만히 있으면 아무것도 움직이지 않는다', () => {
    expect(follow({ dx: 0, dy: 0, ms: 0 }, PHONE)).toEqual({ x: 0, y: 0, veil: 1 })
  })

  it('가로는 저항이 크다 — 넘길지 아직 모르는 상태다', () => {
    const f = follow({ dx: 100, dy: 0, ms: 200 }, PHONE)
    expect(f.x).toBeLessThan(100)
    expect(f.x).toBeGreaterThan(0)
  })

  it('아래로는 거의 그대로 따라온다 — 닫겠다는 뜻이 분명하다', () => {
    const f = follow({ dx: 0, dy: 200, ms: 300 }, PHONE)
    expect(f.y).toBeGreaterThan(150)
    expect(f.y).toBeLessThanOrEqual(200)
  })

  it('위로는 고무줄처럼만 늘어난다', () => {
    const f = follow({ dx: 0, dy: -200, ms: 300 }, PHONE)
    expect(Math.abs(f.y)).toBeLessThan(40)
  })

  it('아래로 당길수록 베일이 옅어지되 투명해지지는 않는다', () => {
    expect(follow({ dx: 0, dy: 100, ms: 200 }, PHONE).veil).toBeLessThan(1)
    // 완전히 투명해지면 닫기도 전에 이미 닫힌 것처럼 보인다.
    expect(follow({ dx: 0, dy: 5000, ms: 200 }, PHONE).veil).toBe(0.25)
  })

  it('위로 올려도 베일은 그대로다', () => {
    expect(follow({ dx: 0, dy: -400, ms: 200 }, PHONE).veil).toBe(1)
  })
})
