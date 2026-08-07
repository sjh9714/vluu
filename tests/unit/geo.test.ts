import { describe, expect, it } from 'vitest'
import {
  bounds,
  distanceKm,
  formatKm,
  mercator,
  niceStep,
  sheet,
  unmercator,
} from '../../src/lib/geo'

/**
 * 도면이 틀려도 화면은 멀쩡해 보인다 — 점이 어딘가에는 찍히고 지도도 어딘가는 나온다.
 * 어긋난 걸 알아채려면 도쿄를 아는 사람이 도쿄 지도를 들여다봐야 한다. 그래서 여기서 잰다.
 */

// 실제 매니페스트에 있는 좌표들.
const OSAKA = { lat: 34.6679, lon: 135.503 }
const KYOTO = { lat: 35.0116, lon: 135.7681 }
const GANGHWA = { lat: 37.7466, lon: 126.481 }

describe('mercator', () => {
  it('세계 한가운데가 0.5, 0.5다', () => {
    expect(mercator({ lat: 0, lon: 0 })).toEqual({ x: 0.5, y: 0.5 })
  })

  it('동쪽이 커지고 북쪽이 작아진다 — 타일 좌표계와 같은 방향', () => {
    expect(mercator({ lat: 0, lon: 10 }).x).toBeGreaterThan(0.5)
    expect(mercator({ lat: 10, lon: 0 }).y).toBeLessThan(0.5)
  })

  it('타일 번호가 알려진 값과 맞는다', () => {
    /*
     * z=12의 12/3637/1612 타일을 실제로 받아보면 신주쿠·나카노·도시마가 찍혀 있다.
     * 그 동네가 대략 35.70°N 139.70°E다.
     *
     * 이 검산이 중요한 이유: 여기가 틀리면 지도는 멀쩡히 나오는데 엉뚱한 동네가 나온다.
     * 사진 위치와 지도가 조용히 어긋나면 알아채는 건 도쿄를 아는 사람뿐이다.
     */
    const p = mercator({ lat: 35.7, lon: 139.7 })
    expect(Math.floor(p.x * 2 ** 12)).toBe(3637)
    expect(Math.floor(p.y * 2 ** 12)).toBe(1612)
  })

  it('되돌리면 제자리로 온다', () => {
    for (const p of [OSAKA, KYOTO, GANGHWA, { lat: -33.9, lon: 151.2 }]) {
      const back = unmercator(mercator(p))
      expect(back.lat).toBeCloseTo(p.lat, 9)
      expect(back.lon).toBeCloseTo(p.lon, 9)
    }
  })

  it('극지방에서 무한대로 가지 않는다', () => {
    for (const lat of [90, -90, 89.999]) {
      const p = mercator({ lat, lon: 0 })
      expect(Number.isFinite(p.y), `lat ${lat}`).toBe(true)
    }
  })
})

describe('distanceKm', () => {
  it('오사카–교토가 손으로 잰 값과 맞는다', () => {
    /*
     * 위도차 0.3437° × 111.2 = 38.2km, 경도차 0.2651° × 111.2 × cos(34.84°) = 24.2km,
     * 빗변 45.2km. 도/라디안이 섞이거나 위경도가 뒤바뀌면 몇 배씩 어긋난다.
     */
    expect(distanceKm(OSAKA, KYOTO)).toBeCloseTo(45.2, 1)
  })

  it('같은 자리는 0, 방향이 바뀌어도 같다', () => {
    expect(distanceKm(GANGHWA, GANGHWA)).toBe(0)
    expect(distanceKm(OSAKA, KYOTO)).toBeCloseTo(distanceKm(KYOTO, OSAKA), 10)
  })

  it('위도 1도는 어디서나 약 111km, 경도 1도는 위도가 높을수록 짧다', () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.2, 0)
    const equator = distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })
    const north = distanceKm({ lat: 60, lon: 0 }, { lat: 60, lon: 1 })
    expect(north / equator).toBeCloseTo(0.5, 2) // cos(60°)
  })
})

describe('bounds', () => {
  it('점이 없으면 상자도 없다', () => {
    expect(bounds([])).toBeNull()
  })

  it('상자의 크기가 실제 거리와 맞는다', () => {
    const box = bounds([OSAKA, KYOTO])!
    expect(box.heightKm).toBeCloseTo(distanceKm(OSAKA, { lat: KYOTO.lat, lon: OSAKA.lon }), 1)
  })

  it('한 점뿐이면 크기가 0인 상자다', () => {
    const box = bounds([GANGHWA])!
    expect(box.widthKm).toBe(0)
    expect(box.heightKm).toBe(0)
  })
})

describe('sheet', () => {
  const pts = [OSAKA, KYOTO, { lat: 34.9671, lon: 135.7727 }]
  const s = sheet(pts, 400, 300, 26)

  it('모든 점이 여백 안에 들어온다', () => {
    for (const p of s.points) {
      expect(p.x).toBeGreaterThanOrEqual(26 - 1e-9)
      expect(p.x).toBeLessThanOrEqual(400 - 26 + 1e-9)
      expect(p.y).toBeGreaterThanOrEqual(26 - 1e-9)
      expect(p.y).toBeLessThanOrEqual(300 - 26 + 1e-9)
    }
  })

  it('북쪽이 위, 동쪽이 오른쪽', () => {
    const [osaka, kyoto] = s.points
    expect(kyoto!.y).toBeLessThan(osaka!.y)
    expect(kyoto!.x).toBeGreaterThan(osaka!.x)
  })

  it('종횡비를 지킨다 — 실제 거리 비가 그림에서도 유지된다', () => {
    const real = distanceKm(OSAKA, KYOTO) / distanceKm(OSAKA, pts[2]!)
    const [a, b, c] = s.points
    const draw = (p: { x: number; y: number }, q: { x: number; y: number }) =>
      Math.hypot(p.x - q.x, p.y - q.y)
    // Mercator는 위도에 따라 늘어나므로 상자 안에서도 아주 조금 어긋난다. 1% 안쪽이면 된다.
    expect(draw(a!, b!) / draw(a!, c!)).toBeCloseTo(real, 1)
  })

  /**
   * 여기가 이 파일에서 제일 중요하다. 지도 이미지는 상자 **전체**를 채우고 점은 그 위에
   * 얹히므로, 둘이 같은 계산에서 나오지 않으면 사진이 지도의 엉뚱한 곳에 찍힌다.
   */
  it('상자가 덮는 지리 범위와 점의 자리가 서로 맞는다', () => {
    for (const [i, p] of pts.entries()) {
      const drawn = s.points[i]!
      // bbox를 선형 보간해 그 점의 자리를 다시 구하면 같은 곳이어야 한다.
      const world = mercator(p)
      const nw = mercator({ lat: s.bbox.north, lon: s.bbox.west })
      const se = mercator({ lat: s.bbox.south, lon: s.bbox.east })
      expect(((world.x - nw.x) / (se.x - nw.x)) * 400).toBeCloseTo(drawn.x, 6)
      expect(((world.y - nw.y) / (se.y - nw.y)) * 300).toBeCloseTo(drawn.y, 6)
    }
  })

  it('범위가 점들을 전부 품는다', () => {
    const box = bounds(pts)!
    expect(s.bbox.west).toBeLessThan(box.minLon)
    expect(s.bbox.east).toBeGreaterThan(box.maxLon)
    expect(s.bbox.south).toBeLessThan(box.minLat)
    expect(s.bbox.north).toBeGreaterThan(box.maxLat)
  })

  it('한 자리에 모인 점들도 0으로 나누지 않고 볼 만한 범위를 낸다', () => {
    // 강화가 그렇다 — 두 장이 같은 좌표다. 도면으로는 점 하나지만 지도로는 동네 하나다.
    const lone = sheet([GANGHWA, GANGHWA], 400, 300, 26)
    expect(lone.degenerate).toBe(true)
    expect(lone.points).toEqual([
      { x: 200, y: 150 },
      { x: 200, y: 150 },
    ])
    expect(lone.kmPerPx).toBeGreaterThan(0)
    // 걸어서 갈 만한 범위. 세계 지도가 나오거나 한 건물만 나오면 둘 다 쓸모없다.
    const across = distanceKm(
      { lat: GANGHWA.lat, lon: lone.bbox.west },
      { lat: GANGHWA.lat, lon: lone.bbox.east },
    )
    expect(across).toBeGreaterThan(0.3)
    expect(across).toBeLessThan(5)
  })

  it('축척이 실제 거리와 맞는다', () => {
    const [osaka, kyoto] = s.points
    const drawnPx = Math.hypot(osaka!.x - kyoto!.x, osaka!.y - kyoto!.y)
    expect(drawnPx * s.kmPerPx).toBeCloseTo(distanceKm(OSAKA, KYOTO), 0)
  })
})

describe('niceStep', () => {
  it('1·2·5 계열만, 도면 폭의 1/4 아래로', () => {
    for (const span of [0.3, 1, 3, 7, 12, 40, 73, 180, 900]) {
      const step = niceStep(span)
      const mantissa = step / 10 ** Math.floor(Math.log10(step))
      expect([1, 2, 5], `span ${span} → ${step}`).toContain(Math.round(mantissa))
      expect(step).toBeLessThanOrEqual(span / 4)
    }
  })

  it('크기가 0이면 축척도 없다', () => {
    expect(niceStep(0)).toBe(0)
  })
})

describe('formatKm', () => {
  it('1km 아래는 미터로', () => {
    expect(formatKm(0.5)).toBe('500 m')
    expect(formatKm(0.05)).toBe('50 m')
  })

  it('작은 값은 소수 한 자리, 큰 값은 정수', () => {
    expect(formatKm(2.5)).toBe('2.5 km')
    expect(formatKm(20)).toBe('20 km')
  })

  it('0은 라벨이 없다', () => {
    expect(formatKm(0)).toBe('')
  })
})
