import { describe, expect, it } from 'vitest'
import { SELECTED } from '#content/selection'
import { CAMERAS, PHOTO_LIST, ROUTE_LIST, getPhoto, getRoute, getRouteOf } from '@/lib/photos'

describe('사진 목록', () => {
  it('셀렉한 만큼 실린다', () => {
    expect(PHOTO_LIST).toHaveLength(SELECTED.length)
  })

  it('모든 사진이 슬러그로 찾아진다', () => {
    for (const photo of PHOTO_LIST) expect(getPhoto(photo.slug)?.key).toBe(photo.key)
  })

  it('시간순으로 정렬된다', () => {
    const times = PHOTO_LIST.map((p) => p.exif.shotAt || `${p.exif.shotDate}T00:00:00`)
    expect(times).toEqual([...times].sort())
  })

  it('현지 시각으로 읽는다 — 새벽에 찍힌 프레임은 없다', () => {
    // 촬영 시각을 UTC로 잘못 읽으면 도쿄 오전 사진이 전날 자정 언저리로 잡힌다.
    const hours = PHOTO_LIST.filter((p) => p.exif.shotAt).map((p) => Number(p.exif.shotAt.slice(11, 13)))
    expect(Math.min(...hours)).toBeGreaterThanOrEqual(6)
  })

  it('원본보다 큰 파생물은 만들지 않는다', () => {
    for (const photo of PHOTO_LIST) {
      expect(Math.max(...photo.widths), photo.key).toBeLessThanOrEqual(photo.width)
    }
  })

  it('WebP 폭은 AVIF 폭의 부분집합이다', () => {
    for (const photo of PHOTO_LIST) {
      for (const width of photo.webpWidths) expect(photo.widths, photo.key).toContain(width)
    }
  })

  it('모든 사진이 대체텍스트를 갖는다', () => {
    for (const photo of PHOTO_LIST) expect(photo.alt.trim(), photo.key).not.toBe('')
  })
})

describe('노선', () => {
  it('모든 사진이 정확히 한 노선에 속한다', () => {
    const counted = ROUTE_LIST.flatMap((r) => r.photos.map((p) => p.key))
    expect(counted).toHaveLength(PHOTO_LIST.length)
    expect(new Set(counted).size).toBe(PHOTO_LIST.length)
  })

  it('구간의 사진을 모두 합치면 노선의 사진이 된다', () => {
    for (const route of ROUTE_LIST) {
      expect(route.legs.flatMap((l) => l.photos)).toHaveLength(route.photos.length)
    }
  })

  it('구간은 날짜순이고 각 구간은 하루만 담는다', () => {
    for (const route of ROUTE_LIST) {
      const dates = route.legs.map((l) => l.date)
      expect(dates).toEqual([...dates].sort())
      for (const leg of route.legs) {
        for (const photo of leg.photos) expect(photo.exif.shotDate).toBe(leg.date)
      }
    }
  })

  it('빈 노선이 없다', () => {
    for (const route of ROUTE_LIST) expect(route.photos.length, route.slug).toBeGreaterThan(0)
  })

  it('사진에서 노선을 되짚을 수 있다', () => {
    for (const route of ROUTE_LIST) {
      for (const photo of route.photos) expect(getRouteOf(photo.slug)?.slug).toBe(route.slug)
    }
    expect(getRoute('kanto')?.title).toBe('Kantō')
  })
})

describe('카메라', () => {
  it('EXIF에 있는 기종만 목록에 오른다', () => {
    expect(CAMERAS).toContain('iPhone 15 Pro')
    expect(CAMERAS.every((c) => c.trim() !== '')).toBe(true)
  })
})
