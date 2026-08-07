import type { LatLon } from '@/lib/geo'
import type { Photo, Route } from '#content/types'

/**
 * 노선 도면의 칸을 정의한다.
 *
 * **한 곳에만 둔다.** 화면을 그리는 컴포넌트와 지도를 굽는 스크립트가 각자 칸을 세면,
 * 어느 한쪽이 바뀌는 순간 지도는 A 범위를 담고 점은 B 범위에 찍힌다 — 그 어긋남은
 * 도쿄를 아는 사람만 알아챈다.
 */

/** 모든 칸이 같은 상자를 쓴다 — 그래야 획과 표식이 칸마다 같은 크기로 보인다. */
export const BOX = { w: 400, h: 300 } as const
/** 점이 가장자리에 붙어 잘리지 않게 두는 여백. 지도는 여백까지 덮는다. */
export const PAD = 26

export const gps = (photo: Photo): LatLon | null => photo.exif.gps

export interface PlotCell {
  /** 파일 이름이자 DOM 손잡이. 노선과 날짜에서 나오므로 절대 안 바뀐다. */
  readonly id: string
  /** 칸 이름표의 첫 칸. 개요는 `All`, 하루는 순번. */
  readonly mark: string
  readonly title: string
  readonly date?: string
  /** 이을 무리. 하루마다 따로 잇는다 — 날 사이는 이동이 아니라 밤이다. */
  readonly groups: readonly (readonly Photo[])[]
  /** 이 칸에 찍히는 사진 전부. */
  readonly photos: readonly Photo[]
}

/**
 * 좌표를 가진 사진이 있는 하루마다 한 칸. 하루가 둘 이상이면 맨 앞에 개요 칸을 둔다.
 *
 * 하루씩 나누는 이유가 있다. 처음엔 노선 전체를 한 장에 그렸는데, 간토는 하코네 왕복
 * 70km가 축척을 지배해서 도쿄에서 찍은 38장이 한구석에 뭉쳐 아무것도 읽히지 않았다.
 * 축척이 정직한 도면은 가장 먼 점이 나머지를 전부 눌러버린다.
 */
export function plotCells(route: Route): PlotCell[] {
  const days = route.legs
    .map((leg, index) => ({ leg, number: index + 1, photos: leg.photos.filter((p) => gps(p)) }))
    .filter((day) => day.photos.length > 0)

  if (days.length === 0) return []

  const cells: PlotCell[] = days.map(({ leg, number, photos }) => ({
    id: `${route.slug}-${leg.date}`,
    mark: String(number),
    title: leg.title,
    date: leg.date,
    groups: [photos],
    photos,
  }))

  // 하루짜리 노선은 개요와 그 하루가 같은 그림이다. 같은 걸 두 번 그리지 않는다.
  if (days.length < 2) return cells

  return [
    {
      id: `${route.slug}-all`,
      mark: 'All',
      title: `${days.length} days`,
      groups: days.map((d) => d.photos),
      photos: days.flatMap((d) => d.photos),
    },
    ...cells,
  ]
}

/** 구워둔 지도 그림의 자리. */
export function basemapSrc(cell: PlotCell): string {
  return `/basemap/${cell.id}.webp`
}
