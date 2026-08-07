import type { PhotoExif } from '#content/types'

/**
 * 촬영정보를 사람이 읽는 모양으로. 값이 없으면 빈 자리를 만들지 않고 아예 뺀다 —
 * 'ISO —' 같은 자리표시자는 정보가 아니라 소음이다.
 */

/** `0.000869` → `1/1151`, `2.5` → `2.5s` */
export function shutter(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null
  if (seconds >= 1) return `${Number(seconds.toFixed(1))}s`
  return `1/${Math.round(1 / seconds)}`
}

/** `1.78` → `ƒ/1.8` */
export function aperture(value: number | null): string | null {
  return value === null ? null : `ƒ/${value.toFixed(1)}`
}

/** `24` → `24mm` (35mm 환산) */
export function focal(value: number | null): string | null {
  return value === null ? null : `${Math.round(value)}mm`
}

export function iso(value: number | null): string | null {
  return value === null ? null : `ISO ${Math.round(value)}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `2025-01-09` → `9 Jan 2025` */
export function date(isoDate: string): string | null {
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return null
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`
}

/** `2025-01-09T09:26:55+09:00` → `09:26` */
export function time(shotAt: string): string | null {
  const match = shotAt.match(/T(\d{2}:\d{2})/)
  return match?.[1] ?? null
}

/** 좌표는 소수점 넷째 자리면 10m 안쪽이다. 그 이상은 정밀한 게 아니라 긴 것이다. */
export function coords(gps: PhotoExif['gps']): string | null {
  if (!gps) return null
  const lat = `${Math.abs(gps.lat).toFixed(4)}°${gps.lat >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(gps.lon).toFixed(4)}°${gps.lon >= 0 ? 'E' : 'W'}`
  return `${lat} ${lon}`
}

/** 뷰어 아래에 한 줄로 놓는 노출 정보. 있는 것만 모아 가운뎃점으로 잇는다. */
export function exposureLine(exif: PhotoExif): string | null {
  const parts = [focal(exif.focalLength35), aperture(exif.aperture), shutter(exif.shutter), iso(exif.iso)]
  const present = parts.filter((part): part is string => part !== null)
  return present.length > 0 ? present.join(' · ') : null
}
