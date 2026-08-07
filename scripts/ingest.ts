/**
 * photos-src/** 의 원본을 읽어 public/media/** 파생물과
 * content/photos.generated.ts 매니페스트를 만든다.
 *
 *   pnpm ingest          바뀐 것만
 *   pnpm ingest --force  전부 다시
 *
 * 두 번 연속 돌려도 산출물이 같아야 한다 (idempotent). 테스트가 이걸 검사한다.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import type { CameraKey, PhotoSource } from '../content/types'
import { SELECTED, isSelected } from '../content/selection'
import { readExif } from './lib/exif'
import { deriveImage } from './lib/image'
import { deriveLive, findLiveSource } from './lib/live'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'photos-src')
const MEDIA_DIR = path.join(ROOT, 'public', 'media')
const SCRATCH_DIR = path.join(ROOT, '.cache', 'decode')
const MANIFEST = path.join(ROOT, 'content', 'photos.generated.ts')

const CAMERA_DIRS: readonly CameraKey[] = ['iphone-15-pro', 'iphone-12-pro-max', 'nikon-z50ii']
const STILL = /\.(heic|jpe?g|png|tiff?)$/i

/** 파일명을 미디어 디렉터리 키로. 제목이 바뀌어도 이 경로는 절대 안 바뀐다. */
function toKey(source: string): string {
  return source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

interface Found {
  readonly source: string
  readonly file: string
  readonly cameraKey: CameraKey
}

async function findSources(): Promise<Found[]> {
  const found: Found[] = []
  for (const cameraKey of CAMERA_DIRS) {
    const dir = path.join(SRC_DIR, cameraKey)
    const entries = await readdir(dir).catch(() => [])
    for (const entry of entries) {
      if (!STILL.test(entry)) continue
      const source = entry.replace(/\.[^.]+$/, '')
      if (!isSelected(source)) continue
      found.push({ source, file: path.join(dir, entry), cameraKey })
    }
  }
  return found.sort((a, b) => a.source.localeCompare(b.source))
}

async function hashFile(file: string): Promise<string> {
  return createHash('sha256').update(await readFile(file)).digest('hex').slice(0, 16)
}

/** 동시에 몇 개까지 구울지. sips가 24MP PNG를 임시로 만들기 때문에 무한정 늘리면 디스크가 터진다. */
async function pool<T, R>(items: T[], limit: number, work: (item: T, i: number) => Promise<R>) {
  const results = new Array<R>(items.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++
        results[i] = await work(items[i] as T, i)
      }
    }),
  )
  return results
}

function serialize(photos: PhotoSource[]): string {
  return `// 이 파일은 \`pnpm ingest\`가 만든다. 직접 고치지 말 것.
// 손으로 쓰는 제목·대체텍스트·캡션은 content/photos.meta.ts에 있다.
import type { PhotoSource } from './types'

export const PHOTOS: readonly PhotoSource[] = ${JSON.stringify(photos, null, 2)} as const
`
}

async function main() {
  const force = process.argv.includes('--force')
  const sources = await findSources()

  const missing = SELECTED.filter((s) => !sources.some((f) => f.source === s))
  if (missing.length > 0) {
    console.error(`✗ 셀렉에 있는데 photos-src에 없는 원본: ${missing.join(', ')}`)
    process.exitCode = 1
    return
  }

  const previous = await readFile(MANIFEST, 'utf8')
    .then((text) => {
      const match = text.match(/PHOTOS: readonly PhotoSource\[\] = ([\s\S]*?) as const/)
      return match?.[1] ? (JSON.parse(match[1]) as PhotoSource[]) : []
    })
    .catch(() => [] as PhotoSource[])
  const cached = new Map(previous.map((p) => [p.source, p]))

  let built = 0
  let skipped = 0

  const photos = await pool(sources, 4, async ({ source, file, cameraKey }) => {
    const key = toKey(source)
    const outDir = path.join(MEDIA_DIR, key)
    const hash = await hashFile(file)

    // EXIF는 파싱이 몇 밀리초라 항상 다시 읽는다. 캐시하면 파싱 로직을 고쳐도
    // 매니페스트에 반영되지 않아, 조용히 틀린 값이 남는다.
    const exif = await readExif(file)

    const hit = cached.get(source)
    if (!force && hit && hit.hash === hash) {
      skipped += 1
      return { ...hit, exif }
    }

    // 이전 산출물을 지우고 다시 굽는다. 폭이 줄어드는 경우 옛 파일이 남는 걸 막는다.
    await rm(outDir, { recursive: true, force: true })

    const [image, movFile] = await Promise.all([
      deriveImage(file, outDir, SCRATCH_DIR),
      findLiveSource(file),
    ])

    if (movFile) await deriveLive(movFile, outDir)

    built += 1
    process.stdout.write(`  ${key} ${image.width}×${image.height}${movFile ? ' + live' : ''}\n`)

    return {
      key,
      source,
      cameraKey,
      width: image.width,
      height: image.height,
      aspect: Number((image.width / image.height).toFixed(6)),
      lqip: image.lqip,
      color: image.color,
      widths: image.widths,
      webpWidths: image.webpWidths,
      live: movFile !== null,
      exif,
      hash,
    } satisfies PhotoSource
  })

  // 매니페스트 순서는 파일명순으로 고정한다 — 동시 처리 순서가 diff에 새지 않도록.
  photos.sort((a, b) => a.source.localeCompare(b.source))

  await mkdir(path.dirname(MANIFEST), { recursive: true })
  await writeFile(MANIFEST, serialize(photos))
  await rm(SCRATCH_DIR, { recursive: true, force: true })

  const live = photos.filter((p) => p.live).length
  const noExif = photos.filter((p) => p.exif.shotAt === '').map((p) => p.source)

  console.log(`\n✓ ${photos.length}프레임 — 새로 구움 ${built}, 건너뜀 ${skipped}, Live ${live}`)
  if (noExif.length > 0) console.log(`  촬영정보 없음: ${noExif.join(', ')}`)
}

await main()
