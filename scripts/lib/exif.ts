import exifr from 'exifr'
import type { PhotoExif } from '../../content/types'

/**
 * exifr은 OffsetTimeOriginal이 있으면 그걸 적용한 **진짜 UTC** Date를 돌려준다.
 * 그래서 UTC 필드를 그대로 읽으면 현지 시각이 아니라 표준시가 나온다 —
 * 도쿄에서 아침 9시 26분에 찍은 사진이 00:26으로 잡히고,
 * 현지 자정~오전 9시 사이에 찍은 프레임은 하루 전 구간으로 밀린다.
 *
 * 오프셋만큼 되돌려서 촬영자가 보던 시계로 읽는다.
 * 오프셋이 없으면 되돌릴 근거가 없으므로 UTC를 그대로 쓴다.
 */
function readWallClock(value: unknown, offset: unknown): { shotAt: string; shotDate: string } | null {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null

  const zone = typeof offset === 'string' && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : ''
  let minutes = 0
  if (zone) {
    const [hh = '0', mm = '0'] = zone.slice(1).split(':')
    minutes = (Number(hh) * 60 + Number(mm)) * (zone.startsWith('-') ? -1 : 1)
  }

  const local = new Date(value.getTime() + minutes * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`
  const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`

  return { shotAt: `${date}T${time}${zone}`, shotDate: date }
}

/**
 * EXIF의 유리수는 1.7799999713880652 같은 꼬리를 달고 나온다.
 * 표시용 값이므로 매니페스트에 들어가기 전에 자른다 — diff도 읽기 쉬워진다.
 */
function finite(value: unknown, digits = 6): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Number(value.toPrecision(digits))
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/**
 * 원본에서 촬영정보를 읽는다. HEIC도 직접 읽는다 — 픽셀과 달리 EXIF는 sips를 거칠 필요가 없다.
 *
 * 값이 없는 경우를 전부 허용한다. 셀렉에는 편집을 거치며 EXIF가 지워진 프레임이 하나 섞여 있고,
 * 앞으로도 그런 게 들어올 수 있다.
 */
export async function readExif(file: string): Promise<PhotoExif> {
  const raw = (await exifr
    .parse(file, { tiff: true, exif: true, gps: true })
    .catch(() => null)) as Record<string, unknown> | null

  const clock = readWallClock(raw?.['DateTimeOriginal'], raw?.['OffsetTimeOriginal'])
  const lat = finite(raw?.['latitude'])
  const lon = finite(raw?.['longitude'])

  return {
    // 시각을 못 읽으면 그룹핑이 불가능하므로 호출부가 눈치채도록 빈 문자열을 남긴다.
    shotAt: clock?.shotAt ?? '',
    shotDate: clock?.shotDate ?? '',
    camera: text(raw?.['Model']),
    lens: text(raw?.['LensModel']),
    focalLength35: finite(raw?.['FocalLengthIn35mmFormat'], 3),
    aperture: finite(raw?.['FNumber'], 3),
    shutter: finite(raw?.['ExposureTime'], 4),
    iso: finite(raw?.['ISO'], 5),
    gps: lat !== null && lon !== null ? { lat, lon } : null,
  }
}
