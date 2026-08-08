import { describe, expect, it } from 'vitest'
import { railPoints } from '../../src/lib/rail'

/**
 * 레일이 틀리면 표식이 엉뚱한 데 서는데, 어느 쪽도 에러를 내지 않아 조용히 산다.
 * 실제 노선이 2 / 8 / 58장이라 한 장짜리 구간부터 쉰여덟 장까지 다 지나간다.
 */

describe('railPoints', () => {
  it('첫 장이 0, 끝 장이 1이다', () => {
    expect(railPoints([8], 1).progress).toBe(0)
    expect(railPoints([8], 8).progress).toBe(1)
  })

  it('사이는 눈금 사이로 나뉜다', () => {
    // 5장이면 칸이 넷이다. 세 번째 장은 딱 절반.
    expect(railPoints([5], 3).progress).toBe(0.5)
    expect(railPoints([5], 2).progress).toBe(0.25)
  })

  it('사진이 한 장뿐이면 0으로 나누지 않는다', () => {
    const one = railPoints([1], 1)
    expect(one.progress).toBe(0)
    expect(Number.isNaN(one.progress)).toBe(false)
    expect(one.ticks).toEqual([])
  })

  it('구간이 하나면 눈금이 없다', () => {
    // Ganghwa가 이렇다 — 2장, 하루.
    expect(railPoints([2], 1).ticks).toEqual([])
    expect(railPoints([2], 2).progress).toBe(1)
  })

  it('눈금은 구간 수보다 하나 적다', () => {
    // 첫 구간의 경계는 레일의 시작이라 그리지 않는다.
    expect(railPoints([3, 3, 2], 1).ticks).toHaveLength(2)
    expect(railPoints([1, 1, 1, 1, 1], 1).ticks).toHaveLength(4)
  })

  it('눈금이 구간이 갈리는 자리에 선다', () => {
    /*
     * 9장을 3+3+3으로 나누면 칸은 여덟이다. 두 번째 구간은 네 번째 장부터
     * 시작하므로 3/8, 세 번째 구간은 일곱 번째 장부터라 6/8이다.
     */
    expect(railPoints([3, 3, 3], 1).ticks).toEqual([3 / 8, 6 / 8])
  })

  it('눈금과 표식이 0과 1 사이를 벗어나지 않는다', () => {
    // 범위 밖을 물어봐도 레일 밖에 그리지 않는다.
    expect(railPoints([4, 4], 0).progress).toBe(0)
    expect(railPoints([4, 4], 99).progress).toBe(1)
    for (const tick of railPoints([1, 1, 1], 2).ticks) {
      expect(tick).toBeGreaterThanOrEqual(0)
      expect(tick).toBeLessThanOrEqual(1)
    }
  })

  it('빈 노선에도 답을 낸다', () => {
    const none = railPoints([], 1)
    expect(none.progress).toBe(0)
    expect(none.ticks).toEqual([])
  })
})
