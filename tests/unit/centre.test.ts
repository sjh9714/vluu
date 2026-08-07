import { describe, expect, it } from 'vitest'
import { nearest, visible, type Span } from '../../src/lib/centre'

/**
 * 이 계산이 틀리면 도면은 A를 가리키는데 B가 재생된다 — 고장으로 보이지만
 * 어느 쪽도 에러를 내지 않아 조용히 산다.
 */

/** 폭 100짜리 프레임이 20 간격으로 늘어선 줄. */
const row: Span[] = ['a', 'b', 'c', 'd'].map((key, i) => ({
  key,
  start: i * 120,
  end: i * 120 + 100,
}))

describe('nearest', () => {
  it('중심이 가장 가까운 것을 고른다', () => {
    expect(nearest(row, 50)).toBe('a') // a의 중심 50
    expect(nearest(row, 170)).toBe('b') // b의 중심 170
    expect(nearest(row, 410)).toBe('d') // d의 중심 410
  })

  it('프레임 사이의 틈에서도 하나를 고른다', () => {
    /*
     * "기준점을 품은 것"으로 고르면 여기서 아무것도 안 골라져 표시가 깜빡인다.
     * 110은 a와 b 사이의 빈 자리다.
     */
    expect(nearest(row, 110)).toBe('a')
    expect(nearest(row, 115)).toBe('b')
  })

  it('양 끝 밖에서도 가장 가까운 것을 고른다', () => {
    expect(nearest(row, -500)).toBe('a')
    expect(nearest(row, 5000)).toBe('d')
  })

  it('동점이면 앞선 것이 이긴다', () => {
    /*
     * 순서가 곧 시간순이다. 흔들릴 때 앞으로 돌아가는 쪽이 뒤로 튀는 것보다 덜 어색하다.
     * 중심이 정확히 겹치는 둘로 잰다 — 줄에서는 a(50)와 b(170)의 가운데인 110이 그 자리다.
     */
    expect(nearest(row, 110)).toBe('a')
    const twins: Span[] = [
      { key: 'first', start: 0, end: 100 },
      { key: 'second', start: 0, end: 100 },
    ]
    expect(nearest(twins, 50)).toBe('first')
  })

  it('아무것도 없으면 아무것도 안 고른다', () => {
    expect(nearest([], 100)).toBeNull()
  })

  it('하나뿐이면 어디서 재든 그것이다', () => {
    expect(nearest([row[0]!], -9999)).toBe('a')
  })
})

describe('visible', () => {
  it('화면에 걸친 것만 남긴다', () => {
    expect(visible(row, 0, 250).map((s) => s.key)).toEqual(['a', 'b', 'c'])
  })

  it('가장자리에 1px만 걸쳐도 보이는 것이다', () => {
    // a는 100에서 끝나고 b는 120에서 시작한다. 양쪽을 1px씩만 무는 창.
    expect(visible(row, 99, 121).map((s) => s.key)).toEqual(['a', 'b'])
  })

  it('딱 붙어 지나간 것은 뺀다', () => {
    // a는 100에서 끝난다. 100부터 보는 창에는 안 걸린다.
    expect(visible(row, 100, 200).map((s) => s.key)).toEqual(['b'])
  })

  it('아무것도 안 보이면 빈 목록', () => {
    expect(visible(row, 10_000, 11_000)).toEqual([])
  })

  it('걸러낸 뒤 고르면 화면 밖 사진은 절대 안 뽑힌다', () => {
    // 화면 밖 프레임이 뽑히면 아무도 못 보는 영상을 받아오게 된다.
    const shown = visible(row, 300, 500)
    expect(nearest(shown, 0)).toBe('c')
  })
})
