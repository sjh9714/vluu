/**
 * 좌표를 도면으로 옮기는 계산.
 *
 * 사진 68장 중 67장이 GPS를 들고 있다. 그걸로 노선을 그리고, 그 아래 실제 지도를 깐다.
 *
 * 투영은 **Web Mercator**다. 타일 서버가 쓰는 것과 같은 투영이어야 구워둔 지도와
 * 점이 어긋나지 않는다 — 처음엔 등장방형으로 그렸는데, 지도를 깔기로 한 순간
 * 그 선택은 더 이상 자유가 아니다.
 */

export interface LatLon {
  readonly lat: number
  readonly lon: number
}

/** 지구 평균 반지름(km). */
const R = 6371.0088

const rad = (deg: number): number => (deg * Math.PI) / 180
const deg = (r: number): number => (r * 180) / Math.PI

/** Mercator가 다루는 위도 한계. 극지방은 무한대로 발산한다. */
const LIMIT = 85.05112878

/**
 * Web Mercator 정규화 좌표. 세계 전체가 0~1이고 y는 아래로(북쪽이 0) 간다 —
 * 타일 좌표계와 같은 방향이라 타일 번호를 바로 뽑을 수 있다.
 */
export function mercator({ lat, lon }: LatLon): { x: number; y: number } {
  const clamped = Math.max(-LIMIT, Math.min(LIMIT, lat))
  const s = Math.sin(rad(clamped))
  return {
    x: (lon + 180) / 360,
    y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI),
  }
}

/** mercator()의 역. 구운 지도의 범위를 위경도로 되돌릴 때 쓴다. */
export function unmercator({ x, y }: { x: number; y: number }): LatLon {
  return {
    lon: x * 360 - 180,
    lat: deg(2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2),
  }
}

export interface Bounds {
  readonly minLat: number
  readonly maxLat: number
  readonly minLon: number
  readonly maxLon: number
  /** 경도 방향의 실제 크기를 잴 때 쓰는 기준 위도. 상자 한가운데. */
  readonly midLat: number
  /** 경계 상자의 실제 크기(km). 축척 바가 이걸 본다. */
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

/** 한 점뿐인 칸이 덮을 범위. 강화가 그렇다 — 아무것도 안 보이는 지도를 굽지 않으려고 둔다. */
const LONE_SPAN_KM = 0.8

export interface Sheet {
  /** 그리기 상자 안의 점 좌표(px). 지도 이미지 위에 그대로 얹힌다. */
  readonly points: readonly { readonly x: number; readonly y: number }[]
  /** **상자 전체**가 덮는 지리 범위. 지도는 정확히 이 범위로 구워야 어긋나지 않는다. */
  readonly bbox: {
    readonly west: number
    readonly south: number
    readonly east: number
    readonly north: number
  }
  /** 그리기 1px이 몇 km인가. 축척 바가 이걸 본다. */
  readonly kmPerPx: number
  /** 좌표가 한 자리뿐인가. 선을 그리면 거짓말이 되는 경우. */
  readonly degenerate: boolean
}

/**
 * 점들을 정해진 크기의 상자에 앉히고, **그 상자가 덮는 지리 범위**를 함께 낸다.
 *
 * 범위를 같이 내는 게 요점이다. 지도 이미지는 상자 전체를 채우고 점은 그 위에 얹히므로,
 * 둘이 같은 계산에서 나오지 않으면 사진이 찍힌 자리가 지도의 엉뚱한 곳에 찍힌다.
 *
 * 여백(pad)은 점이 가장자리에 붙어 잘리지 않게 두는 것이고, 지도는 여백까지 덮는다.
 */
export function sheet(
  points: readonly LatLon[],
  width: number,
  height: number,
  pad: number,
): Sheet {
  const world = points.map(mercator)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const p of world) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }

  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2
  const degenerate = maxX - minX === 0 && maxY - minY === 0

  /*
   * 한 자리뿐이면 확대할 근거가 없다. 그래도 지도는 보여야 하므로 그 자리를 중심으로
   * 걸어서 10분쯤 되는 범위를 잡는다 — 도면으로는 점 하나지만 지도로는 동네 하나다.
   */
  const spanWorld = degenerate
    ? kmToWorld(LONE_SPAN_KM, unmercator({ x: midX, y: midY }).lat)
    : Math.max(maxX - minX, maxY - minY)

  const inner = { w: Math.max(1, width - pad * 2), h: Math.max(1, height - pad * 2) }
  // world 1단위가 몇 px인가. 긴 쪽이 여백 안에 딱 들어가게 잡는다.
  const pxPerWorld = Math.min(inner.w, inner.h) / spanWorld

  const place = (p: { x: number; y: number }) => ({
    x: width / 2 + (p.x - midX) * pxPerWorld,
    y: height / 2 + (p.y - midY) * pxPerWorld,
  })

  // 상자 네 귀퉁이를 world로 되돌리면 그게 지도를 구울 범위다.
  const halfW = width / 2 / pxPerWorld
  const halfH = height / 2 / pxPerWorld
  const nw = unmercator({ x: midX - halfW, y: midY - halfH })
  const se = unmercator({ x: midX + halfW, y: midY + halfH })

  return {
    points: world.map(place),
    bbox: { west: nw.lon, north: nw.lat, east: se.lon, south: se.lat },
    kmPerPx: worldToKm(1 / pxPerWorld, unmercator({ x: midX, y: midY }).lat),
    degenerate,
  }
}

/** world 단위 → km. Mercator는 위도에 따라 늘어나므로 기준 위도가 필요하다. */
function worldToKm(world: number, lat: number): number {
  return world * 2 * Math.PI * R * Math.cos(rad(lat))
}

/** km → world 단위. */
function kmToWorld(km: number, lat: number): number {
  return km / (2 * Math.PI * R * Math.cos(rad(lat)))
}

/** 하버사인. 아는 거리로 검산하는 데 쓴다. */
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
  return magnitude / 2
}

/** 축척 바 라벨. 1km 아래는 m로 읽는 게 자연스럽다. */
export function formatKm(km: number): string {
  if (km === 0) return ''
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${Number(km.toFixed(km < 10 ? 1 : 0))} km`
}
