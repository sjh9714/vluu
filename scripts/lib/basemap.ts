import sharp from 'sharp'
import { ATTRIBUTION } from '../../src/lib/attribution'
import { mercator, type Sheet } from '../../src/lib/geo'

/**
 * 도면 칸 하나가 덮는 범위의 지도를 한 장으로 구워낸다.
 *
 * 방문자에게는 `<img>` 한 장만 간다. 런타임에 지도 라이브러리도, 타일 요청도 없다 —
 * 이 사이트가 "붙어 있는 외부 서비스 0"을 지키는 방식이다. 대신 여기서 타일을 받아
 * 이어 붙이고 잘라 커밋한다.
 *
 * 타일은 CARTO Positron. 키가 없고, 거의 흰 바탕에 회색 선이라 이 사이트의 팔레트와
 * 그대로 맞는다. **표기 의무가 있다** — 화면에 © OpenStreetMap contributors © CARTO.
 */

const TILE = 256
/** `@2x` 타일은 한 장이 512px다. 레티나에서 지명이 뭉개지지 않으려면 이쪽이어야 한다. */
const RETINA = 2
const MAX_ZOOM = 19

// 화면에 이 문구가 그대로 나간다. 출처를 바꾸면 저기부터 고쳐야 한다.
void ATTRIBUTION

const STYLE = 'light_all'
const endpoint = (z: number, x: number, y: number) =>
  `https://basemaps.cartocdn.com/${STYLE}/${z}/${x}/${y}@2x.png`

/**
 * 이 범위를 목표 크기에 담으려면 몇 번째 줌인가.
 *
 * 반올림한다. 처음엔 올림을 썼는데 — 모자란 것보다 넘치는 게 낫다는 생각으로 —
 * 줌이 한 단계 오르면 타일이 **네 배**로 늘어난다. 칸 하나에 35장을 받다가
 * CDN이 연결을 끊었다. 어차피 목표 크기로 줄여서 저장하므로 그 정밀도는 버려진다.
 */
function pickZoom(sheet: Sheet, widthPx: number): number {
  const west = mercator({ lat: sheet.bbox.north, lon: sheet.bbox.west })
  const east = mercator({ lat: sheet.bbox.south, lon: sheet.bbox.east })
  const world = east.x - west.x
  if (!(world > 0)) return MAX_ZOOM
  return Math.max(0, Math.min(MAX_ZOOM, Math.round(Math.log2(widthPx / (world * TILE)))))
}

/** 한 번에 물고 있을 요청 수. 남의 CDN이다. */
const LANES = 4
const TRIES = 3

async function fetchTile(url: string): Promise<Buffer> {
  let last: unknown
  for (let attempt = 1; attempt <= TRIES; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: {
          // 타일 서버가 누가 받아가는지 알 수 있어야 한다. 익명 대량 요청은 예의가 아니다.
          'User-Agent': 'vluu-gallery basemap baker (https://github.com/sjh9714/vluu)',
        },
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) throw new Error(`타일 ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (error) {
      last = error
      // 끊긴 건 대개 우리가 몰아쳤기 때문이다. 조금 쉬었다 다시 묻는다.
      if (attempt < TRIES) await new Promise((r) => setTimeout(r, 400 * attempt))
    }
  }
  throw new Error(`타일을 못 받았다 (${TRIES}번): ${url} — ${String(last)}`)
}

/** 정해진 수만큼만 동시에 굴린다. */
async function pool<T, R>(items: readonly T[], lanes: number, run: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(lanes, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++
        out[i] = await run(items[i]!)
      }
    }),
  )
  return out
}

export interface Baked {
  readonly data: Buffer
  readonly zoom: number
  readonly tiles: number
}

/**
 * 범위를 덮는 타일을 받아 이어 붙이고, 정확히 그 범위만 잘라 목표 크기로 낸다.
 *
 * 자르는 게 요점이다. 타일 경계는 우리 상자와 아무 상관이 없으므로, 타일 그대로
 * 붙이면 지도가 상자보다 넓거나 좁게 담긴다 — 그러면 점이 지도 위 엉뚱한 곳에 찍힌다.
 */
export async function bakeBasemap(sheet: Sheet, width: number, height: number): Promise<Baked> {
  const scale = TILE * RETINA
  const zoom = pickZoom(sheet, width * RETINA)
  const n = 2 ** zoom

  const nw = mercator({ lat: sheet.bbox.north, lon: sheet.bbox.west })
  const se = mercator({ lat: sheet.bbox.south, lon: sheet.bbox.east })

  // 상자의 네 귀퉁이가 이 줌에서 몇 번째 타일의 몇 px인가.
  const left = nw.x * n * scale
  const top = nw.y * n * scale
  const right = se.x * n * scale
  const bottom = se.y * n * scale

  const x0 = Math.floor(left / scale)
  const x1 = Math.floor((right - 1e-6) / scale)
  const y0 = Math.floor(top / scale)
  const y1 = Math.floor((bottom - 1e-6) / scale)

  const wrap = (v: number) => ((v % n) + n) % n
  const jobs: { x: number; y: number; url: string }[] = []
  for (let y = y0; y <= y1; y += 1) {
    if (y < 0 || y >= n) continue
    for (let x = x0; x <= x1; x += 1) {
      jobs.push({ x, y, url: endpoint(zoom, wrap(x), y) })
    }
  }

  const tiles = await pool(jobs, LANES, async (job) => ({
    ...job,
    data: await fetchTile(job.url),
  }))

  const sheetW = (x1 - x0 + 1) * scale
  const sheetH = (y1 - y0 + 1) * scale
  const stitched = await sharp({
    create: { width: sheetW, height: sheetH, channels: 3, background: '#ffffff' },
  })
    .composite(
      tiles.map((t) => ({
        input: t.data,
        left: (t.x - x0) * scale,
        top: (t.y - y0) * scale,
      })),
    )
    .png()
    .toBuffer()

  const data = await sharp(stitched)
    .extract({
      left: Math.round(left - x0 * scale),
      top: Math.round(top - y0 * scale),
      width: Math.max(1, Math.round(right - left)),
      height: Math.max(1, Math.round(bottom - top)),
    })
    .resize(width * RETINA, height * RETINA, { fit: 'fill' })
    .webp({ quality: 82, effort: 5 })
    .toBuffer()

  return { data, zoom, tiles: tiles.length }
}
