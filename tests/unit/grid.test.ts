import { describe, expect, it } from 'vitest'
import { COLUMNS, frameLabel, gridSizes } from '@/lib/grid'
import { FRAME_TOTAL, PHOTO_LIST, ROUTE_LIST, frameNumber } from '@/lib/photos'

describe('카탈로그 번호', () => {
  const displayOrder = ROUTE_LIST.flatMap((route) => route.legs).flatMap((leg) => leg.photos)

  it('실린 사진 전부에 번호가 있다', () => {
    expect(FRAME_TOTAL).toBe(PHOTO_LIST.length)
    for (const photo of PHOTO_LIST) expect(frameNumber(photo.slug), photo.key).toBeDefined()
  })

  it('1부터 빠짐도 중복도 없이 이어진다', () => {
    const numbers = displayOrder.map((photo) => frameNumber(photo.slug))
    expect(numbers).toEqual(Array.from({ length: FRAME_TOTAL }, (_, i) => i + 1))
  })

  it('번호 순서가 화면에 놓이는 순서와 같다', () => {
    // 노선 → 구간을 평탄화한 게 인덱스에서 눈에 보이는 순서다.
    // 여기가 어긋나면 001 다음에 004가 나오는 카탈로그가 된다.
    for (const [i, photo] of displayOrder.entries()) {
      expect(frameNumber(photo.slug), photo.key).toBe(i + 1)
    }
  })

  it('세 자리로 맞춰 표시한다', () => {
    expect(frameLabel(1)).toBe('001')
    expect(frameLabel(68)).toBe('068')
  })
})

describe('그리드 치수', () => {
  it('열 수는 화면이 좁아질수록 줄어든다', () => {
    const widths = COLUMNS.map((c) => c.minWidth)
    const columns = COLUMNS.map((c) => c.columns)
    expect(widths).toEqual([...widths].sort((a, b) => b - a))
    expect(columns).toEqual([...columns].sort((a, b) => b - a))
  })

  it('sizes가 열 수만큼의 구간을 갖고 좁을수록 셀이 커진다', () => {
    const sizes = gridSizes()
    expect(sizes.split(',')).toHaveLength(COLUMNS.length)

    // 열이 적을수록 한 장이 차지하는 화면 비율은 커져야 한다.
    const vw = [...sizes.matchAll(/([\d.]+)vw/g)].map((m) => Number(m[1]))
    expect(vw).toEqual([...vw].sort((a, b) => a - b))
  })

  it('여백을 빼주므로 뷰포트를 열 수로 그냥 나눈 값보다 작다', () => {
    // 이걸 빼먹으면 브라우저가 한 단계 큰 파일을 고르고, 68장이면 수백 KB가 샌다.
    for (const clause of gridSizes().split(',')) {
      expect(clause).toContain('calc(')
      expect(clause).toMatch(/-\s*\d+px/)
    }
  })
})
