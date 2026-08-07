import { describe, expect, it } from 'vitest'
import { EXCLUDED, SELECTED, TOTAL_FRAMES, isSelected } from '#content/selection'

describe('셀렉', () => {
  it('셀렉과 제외를 합치면 촬영 원본 전체가 된다', () => {
    expect(SELECTED.length + Object.keys(EXCLUDED).length).toBe(TOTAL_FRAMES)
  })

  it('같은 프레임이 두 번 들어있지 않다', () => {
    expect(new Set(SELECTED).size).toBe(SELECTED.length)
  })

  it('셀렉과 제외가 겹치지 않는다', () => {
    const cut = new Set(Object.keys(EXCLUDED))
    expect(SELECTED.filter((s) => cut.has(s))).toEqual([])
  })

  it('제외한 프레임에는 전부 이유가 붙어 있다', () => {
    for (const [source, reason] of Object.entries(EXCLUDED)) {
      expect(reason.trim(), `${source}에 이유가 없다`).not.toBe('')
    }
  })

  it('isSelected가 셀렉 여부를 가른다', () => {
    expect(isSelected('IMG_5612')).toBe(true)
    expect(isSelected('IMG_5613')).toBe(false)
    expect(isSelected('없는파일')).toBe(false)
  })
})
