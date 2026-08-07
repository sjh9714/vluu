import { PHOTOS } from '#content/photos.generated'
import { PHOTO_META } from '#content/photos.meta'
import { ROUTES } from '#content/routes'
import type { Leg, Photo, PhotoSource, Route } from '#content/types'

/**
 * 생성된 매니페스트와 손으로 쓴 메타를 합쳐 앱이 쓸 모양으로 만든다.
 * 모듈 최상단에서 한 번만 돌고, 결과는 빌드 타임에 고정된다.
 */

function join(source: PhotoSource): Photo {
  const meta = PHOTO_META[source.key]
  if (!meta) {
    throw new Error(
      `${source.key}에 대한 메타데이터가 없다. content/photos.meta.ts에 제목·대체텍스트·캡션을 추가할 것.`,
    )
  }
  return {
    ...source,
    ...meta,
    slug: meta.slug ?? source.key,
    // EXIF에 촬영일이 없으면 손으로 넣은 보정값을 쓴다.
    exif: source.exif.shotDate ? source.exif : { ...source.exif, shotDate: meta.shotDate ?? '' },
  }
}

/**
 * 시간순. 촬영 시각을 모르는 프레임은 그날의 **끝**에 둔다.
 * 앞에 두면 시각을 모른다는 이유만으로 노선의 첫 장이 되어버린다.
 */
function chronological(a: Photo, b: Photo): number {
  const left = a.exif.shotAt || `${a.exif.shotDate}T99`
  const right = b.exif.shotAt || `${b.exif.shotDate}T99`
  return left.localeCompare(right) || a.key.localeCompare(b.key)
}

export const PHOTO_LIST: readonly Photo[] = PHOTOS.map(join).sort(chronological)

const bySlug = new Map(PHOTO_LIST.map((p) => [p.slug, p]))
export function getPhoto(slug: string): Photo | undefined {
  return bySlug.get(slug)
}

export const ROUTE_LIST: readonly Route[] = ROUTES.map((def) => {
  const photos = PHOTO_LIST.filter(
    (p) => p.exif.shotDate >= def.from && p.exif.shotDate <= def.to,
  )

  const byDate = new Map<string, Photo[]>()
  for (const photo of photos) {
    const bucket = byDate.get(photo.exif.shotDate)
    if (bucket) bucket.push(photo)
    else byDate.set(photo.exif.shotDate, [photo])
  }

  const legs: Leg[] = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      title: def.legTitles[date] ?? date,
      photos: items,
    }))

  return { slug: def.slug, title: def.title, intro: def.intro, legs, photos }
})

const routeBySlug = new Map(ROUTE_LIST.map((r) => [r.slug, r]))
export function getRoute(slug: string): Route | undefined {
  return routeBySlug.get(slug)
}

/**
 * 카탈로그 번호. 001부터 68까지.
 *
 * `PHOTO_LIST`가 아니라 **`ROUTE_LIST`를 평탄화한 순서**에서 뽑는다. 인덱스가
 * 노선 → 구간으로 나뉘어 보이므로, 화면에 놓이는 순서를 그대로 번호로 삼아야
 * 둘이 어긋날 수 없다. 두 순서가 지금은 같지만 같다는 사실에 기대지 않는다.
 */
const FRAME_NUMBER: ReadonlyMap<string, number> = new Map(
  ROUTE_LIST.flatMap((route) => route.legs).flatMap((leg) => leg.photos).map((photo, i) => [photo.slug, i + 1]),
)

export function frameNumber(slug: string): number | undefined {
  return FRAME_NUMBER.get(slug)
}

/** 카탈로그 전체 장수. `023 / 068`의 분모. */
export const FRAME_TOTAL = FRAME_NUMBER.size

/** 어떤 사진이 어느 노선에 있는지 — 상세에서 앞뒤로 넘길 때 쓴다. */
const routeOfPhoto = new Map<string, Route>()
for (const route of ROUTE_LIST) {
  for (const photo of route.photos) routeOfPhoto.set(photo.slug, route)
}
export function getRouteOf(slug: string): Route | undefined {
  return routeOfPhoto.get(slug)
}

/** EXIF가 말하는 기종들. 카메라 전환 필터가 이 목록으로 만들어진다. */
export const CAMERAS: readonly string[] = [
  ...new Set(PHOTO_LIST.map((p) => p.exif.camera).filter((c): c is string => c !== null)),
].sort()
