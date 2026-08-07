import { execFile } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'

const run = promisify(execFile)

/**
 * 구울 파생물 폭. 원본보다 큰 폭은 만들지 않는다.
 *
 * 상한이 2048인 이유: 3:4 세로 사진이 16인치 맥북(3456×2234)의 높이를 꽉 채울 때
 * 필요한 폭이 1675px다. 2048은 거기에 여유를 준다. 2560까지 올리면 픽셀은 25%
 * 늘지만 바이트는 55% 늘고, 뷰어는 어차피 네이티브 해상도에서 확대를 멈춘다.
 */
export const TARGET_WIDTHS = [320, 640, 1280, 2048] as const

/**
 * WebP는 폴백 전용이다. 같은 화질에서 AVIF의 두 배 가까이 나가므로
 * 전 구간을 굽지 않고, AVIF를 못 읽는 브라우저(2023년 이전 Safari 등)가
 * 쓸 만한 두 폭만 남긴다.
 */
const WEBP_WIDTHS = new Set<number>([640, 1280])

/**
 * sharp는 아이폰 HEIC를 직접 못 읽는다.
 * libvips에 heif 입력이 있긴 한데, Live Photo HEIC는 iref 참조가 45개라
 * libheif의 기본 보안 한도(16)에 걸려 "corrupt header"로 거절당한다.
 * 그래서 macOS 내장 sips로 먼저 PNG(무손실)로 편다.
 *
 * sips는 픽셀을 센서 방향(가로) 그대로 두고 EXIF orientation 태그만 붙여 내보내므로,
 * 이걸 정규화하지 않으면 세로 사진이 전부 누운 채로 나온다.
 * sharp의 `.rotate()`(인자 없음)가 그 태그를 읽어 실제로 회전시킨다.
 */
async function decode(file: string, scratchDir: string): Promise<{ input: string; temp?: string }> {
  if (!/\.heic$/i.test(file)) return { input: file }

  await mkdir(scratchDir, { recursive: true })
  const temp = path.join(scratchDir, `${path.basename(file, path.extname(file))}.png`)
  await run('sips', ['-s', 'format', 'png', file, '--out', temp])
  return { input: temp, temp }
}

export interface DerivedImage {
  readonly width: number
  readonly height: number
  /** AVIF로 구워진 폭 — 실제 전달 경로. */
  readonly widths: number[]
  /** WebP로도 구워진 폭 — 폴백 경로. widths의 부분집합. */
  readonly webpWidths: number[]
  readonly lqip: string
  readonly color: string
}

/**
 * 원본 하나를 받아 `outDir`에 반응형 세트를 굽고, 앱이 필요로 하는 부수 정보를 돌려준다.
 * AVIF와 WebP를 함께 굽는다 — AVIF가 30~50% 작지만 폴백이 있어야 한다.
 */
export async function deriveImage(
  file: string,
  outDir: string,
  scratchDir: string,
): Promise<DerivedImage> {
  const { input, temp } = await decode(file, scratchDir)

  try {
    // rotate()를 먼저 태워야 이후 모든 크기가 '보이는 방향' 기준이 된다.
    const upright = sharp(input, { limitInputPixels: false }).rotate()
    const { width, height } = await upright.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info)

    await mkdir(outDir, { recursive: true })

    // 원본보다 크게 만들지 않는다. 저해상도 프레임이 억지로 늘어나 혼자 뭉개지는 걸 막는다.
    const widths: number[] = TARGET_WIDTHS.filter((w) => w <= width)
    if (widths.length === 0) widths.push(width)

    const webpWidths: number[] = []
    for (const w of widths) {
      const resized = upright.clone().resize({ width: w, withoutEnlargement: true })
      const jobs = [resized.clone().avif({ quality: 50, effort: 6 }).toFile(path.join(outDir, `${w}.avif`))]
      if (WEBP_WIDTHS.has(w)) {
        webpWidths.push(w)
        jobs.push(resized.clone().webp({ quality: 68, effort: 5 }).toFile(path.join(outDir, `${w}.webp`)))
      }
      await Promise.all(jobs)
    }

    // LQIP — DOM 폴백의 배경이자 GL이 고해상도를 기다리는 동안 올릴 첫 텍스처.
    const lqipBuffer = await upright.clone().resize({ width: 32 }).webp({ quality: 55 }).toBuffer()
    const lqip = `data:image/webp;base64,${lqipBuffer.toString('base64')}`

    const { dominant } = await upright.clone().stats()
    const hex = (n: number) => n.toString(16).padStart(2, '0')
    const color = `#${hex(dominant.r)}${hex(dominant.g)}${hex(dominant.b)}`

    return { width, height, widths, webpWidths, lqip, color }
  } finally {
    if (temp) await rm(temp, { force: true })
  }
}
