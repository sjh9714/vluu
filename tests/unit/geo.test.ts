import { describe, expect, it } from 'vitest'
import { bounds, distanceKm, formatKm, niceStep, project } from '../../src/lib/geo'

/**
 * 도면이 틀려도 화면은 멀쩡해 보인다 — 점이 어딘가에는 찍히기 때문이다.
 * 그래서 아는 거리와 아는 모양으로 검산한다.
 */

// 실제 매니페스트에 있는 좌표들.
const OSAKA = { lat: 34.6679, lon: 135.503 }
const KYOTO = { lat: 35.0116, lon: 135.7681 }
const GANGHWA = { lat: 37.7466, lon: 126.481 }

describe('distanceKm', () => {
  it('오사카–교토가 손으로 잰 값과 맞는다', () => {
    /*
     * 두 좌표를 평면으로 근사하면
     *   위도차 0.3437° × 111.2 = 38.2km
     *   경도차 0.2651° × 111.2 × cos(34.84°) = 24.2km
     *   빗변 45.2km
     * 이 규모에서 하버사인과 평면 근사의 차이는 미터 단위다. 도/라디안이 섞이거나
     * 위경도가 뒤바뀌면 여기서 몇 배씩 어긋난다.
     */
    expect(distanceKm(OSAKA, KYOTO)).toBeCloseTo(45.2, 1)
  })

  it('같은 자리는 0이다', () => {
    expect(distanceKm(GANGHWA, GANGHWA)).toBe(0)
  })

  it('방향이 바뀌어도 같다', () => {
    expect(distanceKm(OSAKA, KYOTO)).toBeCloseTo(distanceKm(KYOTO, OSAKA), 10)
  })

  it('위도 1도는 어디서나 약 111km다', () => {
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111.2, 0)
    expect(distanceKm({ lat: 60, lon: 0 }, { lat: 61, lon: 0 })).toBeCloseTo(111.2, 0)
  })

  it('경도 1도는 위도가 높을수록 짧다', () => {
    const equator = distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })
    const north = distanceKm({ lat: 60, lon: 0 }, { lat: 60, lon: 1 })
    // cos(60°) = 0.5
    expect(north / equator).toBeCloseTo(0.5, 2)
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
    expect(box.midLat).toBe(GANGHWA.lat)
  })
})

describe('project', () => {
  const pts = [OSAKA, KYOTO, { lat: 34.9671, lon: 135.7727 }]
  const box = bounds(pts)!
  const plot = project(pts, box)

  it('긴 변이 정확히 1이고 짧은 변은 그 비율이다', () => {
    expect(Math.max(plot.width, plot.height)).toBeCloseTo(1, 12)
    expect(plot.width / plot.height).toBeCloseTo(box.widthKm / box.heightKm, 10)
  })

  it('모든 점이 상자 안에 있다', () => {
    for (const p of plot.points) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-12)
      expect(p.x).toBeLessThanOrEqual(plot.width + 1e-12)
      expect(p.y).toBeGreaterThanOrEqual(-1e-12)
      expect(p.y).toBeLessThanOrEqual(plot.height + 1e-12)
    }
  })

  it('북쪽이 위다', () => {
    const [osaka, kyoto] = plot.points
    // 교토가 오사카보다 북쪽이므로 y가 작아야 한다. 여기가 뒤집히면 도면이 남북으로 뒤집힌다.
    expect(kyoto!.y).toBeLessThan(osaka!.y)
  })

  it('동쪽이 오른쪽이다', () => {
    const [osaka, kyoto] = plot.points
    expect(kyoto!.x).toBeGreaterThan(osaka!.x)
  })

  it('종횡비를 지킨다 — 거리 비가 그리기 좌표에서도 유지된다', () => {
    const realRatio = distanceKm(OSAKA, KYOTO) / distanceKm(OSAKA, pts[2]!)
    const [a, b, c] = plot.points
    const draw = (p: { x: number; y: number }, q: { x: number; y: number }) =>
      Math.hypot(p.x - q.x, p.y - q.y)
    expect(draw(a!, b!) / draw(a!, c!)).toBeCloseTo(realRatio, 3)
  })

  it('한 자리에 모인 점들은 0으로 나누지 않고 가운데에 놓인다', () => {
    // 강화가 그렇다 — 두 장이 같은 좌표다. 여기서 NaN이 나면 도면이 통째로 사라진다.
    const single = [GANGHWA, GANGHWA]
    const p = project(single, bounds(single)!)
    expect(p.degenerate).toBe(true)
    expect(p.kmPerUnit).toBe(0)
    expect(p.points).toEqual([
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
    ])
    expect(p.points.every((q) => Number.isFinite(q.x) && Number.isFinite(q.y))).toBe(true)
  })
})

describe('niceStep', () => {
  it('1·2·5 계열만 낸다', () => {
    for (const span of [0.3, 1, 3, 7, 12, 40, 73, 180, 900]) {
      const step = niceStep(span)
      const mantissa = step / 10 ** Math.floor(Math.log10(step))
      expect([1, 2, 5], `span ${span} → ${step}`).toContain(Math.round(mantissa))
    }
  })

  it('도면 폭의 1/4을 넘지 않는다', () => {
    for (const span of [0.3, 1, 3, 7, 12, 40, 73, 180, 900]) {
      expect(niceStep(span), `span ${span}`).toBeLessThanOrEqual(span / 4)
    }
  })

  it('크기가 0이면 축척도 없다', () => {
    expect(niceStep(0)).toBe(0)
  })
})

describe('formatKm', () => {
  it('1km 아래는 미터로 읽는다', () => {
    expect(formatKm(0.5)).toBe('500 m')
    expect(formatKm(0.05)).toBe('50 m')
  })

  it('작은 값은 소수 한 자리까지, 큰 값은 정수로', () => {
    expect(formatKm(2.5)).toBe('2.5 km')
    expect(formatKm(20)).toBe('20 km')
  })

  it('0은 라벨이 없다', () => {
    expect(formatKm(0)).toBe('')
  })
})
