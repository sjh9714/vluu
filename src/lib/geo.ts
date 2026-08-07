/**
 * 좌표를 도면으로 옮기는 계산.
 *
 * 사진 68장 중 67장이 GPS를 들고 있는데 지금까지는 뷰어 아래 `37.7466°N` 텍스트로만
 * 쓰였다. 이 사이트의 개념이 "여행 = 노선, 날짜 = 구간"인데 정작 그 노선이 그려진 적이 없다.
 *
 * 베이스맵은 붙이지 않는다. 순백 큐브에 지도 타일을 얹는 순간 다른 사이트가 되고,
 * 외부 서비스 의존이 0이라는 이 프로젝트의 성질도 함께 사라진다. 좌표만으로 그린다.
 *
 * 투영은 **등장방형 + 위도 보정**이다. 메르카토르를 쓸 이유가 없다 — 우리 상자는
 * 위도 34°~38° 사이의 한 변 70km짜리이고, 그 안에서 두 투영의 차이는 픽셀 아래다.
 * 대신 이 식은 한 줄이라 손으로 검산된다.
 */

export interface LatLon {
  readonly lat: number
  readonly lon: number
}

/** 지구 평균 반지름(km). */
const R = 6371.0088

const rad = (deg: number): number => (deg * Math.PI) / 180

export interface Bounds {
  readonly minLat: number
  readonly maxLat: number
  readonly minLon: number
  readonly maxLon: number
  /** 경도 방향을 줄일 때 쓰는 기준 위도. 상자 한가운데. */
  readonly midLat: number
  /** 경계 상자의 실제 크기(km). */
  readonly widthKm: number
  readonly heightKm: number
}

/** 점이 없으면 상자도 없다. 한 점뿐이면 크기가 0인 상자가 나온다 — 그것도 사실이다. */
export function bounds(points: readonly LatLon[]): Bounds | null {
  if (points.length === 0) return null

  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lon < minLon) minLon = p.lon
    if (p.lon > maxLon) maxLon = p.lon
  }

  const midLat = (minLat + maxLat) / 2
  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
    midLat,
    widthKm: rad(maxLon - minLon) * R * Math.cos(rad(midLat)),
    heightKm: rad(maxLat - minLat) * R,
  }
}

export interface Plot {
  /** 그리기 좌표. 긴 변이 정확히 1이고 짧은 변은 그 비율만큼이다. y는 아래로 — 북쪽이 위. */
  readonly points: readonly { readonly x: number; readonly y: number }[]
  /** 그리기 상자. viewBox에 그대로 쓴다. */
  readonly width: number
  readonly height: number
  /** 그리기 좌표 1.0이 실제로 몇 km인가. 축척 바가 이걸 본다. 한 점뿐이면 0. */
  readonly kmPerUnit: number
  /** 모든 점이 같은 자리인가. 선을 그리면 거짓말이 되는 경우. */
  readonly degenerate: boolean
}

/**
 * 종횡비를 지켜서 옮긴다. 상자를 늘려 채우면 도면이 아니라 그림이 된다 —
 * 축척 바가 두 축에서 다른 뜻이 되어버린다.
 */
export function project(points: readonly LatLon[], box: Bounds): Plot {
  const span = Math.max(box.widthKm, box.heightKm)

  // 모든 점이 한 자리. 강화가 그렇다 — 두 장이 같은 좌표를 들고 있다.
  if (span === 0) {
    return {
      points: points.map(() => ({ x: 0.5, y: 0.5 })),
      width: 1,
      height: 1,
      kmPerUnit: 0,
      degenerate: true,
    }
  }

  const width = box.widthKm / span
  const height = box.heightKm / span

  return {
    points: points.map((p) => ({
      x: (rad(p.lon - box.minLon) * R * Math.cos(rad(box.midLat))) / span,
      // 위도는 북쪽이 큰데 화면은 아래로 커진다. 여기서 한 번만 뒤집는다.
      y: (rad(box.maxLat - p.lat) * R) / span,
    })),
    width,
    height,
    kmPerUnit: span,
    degenerate: false,
  }
}

export interface Placement {
  /** 그리기 상자 안의 좌표. */
  readonly points: readonly { readonly x: number; readonly y: number }[]
  /** 그리기 1단위가 몇 km인가. 축척 바의 길이가 여기서 나온다. 한 자리뿐이면 0. */
  readonly unitsPerKm: number
}

/**
 * 정규화된 도면을 정해진 상자 안에 넣는다. 종횡비를 지키고 남는 쪽은 가운데 정렬한다.
 *
 * 상자 크기를 모든 칸에서 똑같이 쓰는 게 요점이다. 칸마다 viewBox가 다르면 획 두께와
 * 표식 크기가 칸마다 달라 보여서, 같은 축척으로 그린 것처럼 읽히지 않는다.
 */
export function fit(plot: Plot, width: number, height: number, pad: number): Placement {
  const inner = { w: Math.max(1, width - pad * 2), h: Math.max(1, height - pad * 2) }
  const scale = Math.min(inner.w / plot.width, inner.h / plot.height)
  const offsetX = pad + (inner.w - plot.width * scale) / 2
  const offsetY = pad + (inner.h - plot.height * scale) / 2

  return {
    points: plot.points.map((p) => ({ x: offsetX + p.x * scale, y: offsetY + p.y * scale })),
    unitsPerKm: plot.kmPerUnit > 0 ? scale / plot.kmPerUnit : 0,
  }
}

/** 하버사인. 총 이동거리와 검산에 쓴다. */
export function distanceKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * 축척 바에 쓸 거리.
 *
 * 도면 폭의 1/4을 넘지 않는 가장 큰 1·2·5 × 10ⁿ. 자와 지도가 쓰는 계열 그대로다 —
 * "18.3km" 같은 눈금은 재라는 뜻이 아니라 계산했다는 뜻이라 아무도 안 읽는다.
 */
export function niceStep(spanKm: number): number {
  const target = spanKm / 4
  if (!(target > 0)) return 0

  const magnitude = 10 ** Math.floor(Math.log10(target))
  for (const factor of [5, 2, 1]) {
    if (factor * magnitude <= target) return factor * magnitude
  }
  // target이 자기 자릿수의 1배에도 못 미치는 경우 — 한 자리 내린다.
  return magnitude / 2
}

/** 축척 바 라벨. 1km 아래는 m로 읽는 게 자연스럽다. */
export function formatKm(km: number): string {
  if (km === 0) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${Number(km.toFixed(km < 10 ? 1 : 0))} km`
}
