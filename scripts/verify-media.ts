/**
 * 콘텐츠 레이어가 실제 파일과 어긋나지 않았는지 검사한다.
 *
 * ingest는 자기가 만든 것만 안다. 이 스크립트는 반대편에서 본다 —
 * 매니페스트가 약속한 파일이 진짜 있는지, 뺀 프레임이 슬그머니 돌아오지 않았는지,
 * 모든 사진이 사람이 쓴 설명을 갖고 있는지.
 *
 *   pnpm verify:media
 */
import { access, readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { EXCLUDED, SELECTED, TOTAL_FRAMES } from '../content/selection'
import { PHOTOS } from '../content/photos.generated'
import { PHOTO_META } from '../content/photos.meta'
import { ROUTES } from '../content/routes'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MEDIA_DIR = path.join(ROOT, 'public', 'media')

const problems: string[] = []
const note = (message: string) => problems.push(message)

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  )
}

// ── 셀렉과 매니페스트가 같은 것을 가리키는가 ──────────────
if (SELECTED.length + Object.keys(EXCLUDED).length !== TOTAL_FRAMES) {
  note(`셀렉(${SELECTED.length}) + 제외(${Object.keys(EXCLUDED).length}) ≠ 원본(${TOTAL_FRAMES})`)
}
if (PHOTOS.length !== SELECTED.length) {
  note(`매니페스트 ${PHOTOS.length}장인데 셀렉은 ${SELECTED.length}장 — ingest를 다시 돌릴 것`)
}
for (const source of Object.keys(EXCLUDED)) {
  if (PHOTOS.some((p) => p.source === source)) note(`뺀 프레임이 매니페스트에 있다: ${source}`)
}

// ── 매니페스트가 약속한 파일이 실제로 있는가 ──────────────
for (const photo of PHOTOS) {
  const dir = path.join(MEDIA_DIR, photo.key)

  for (const width of photo.widths) {
    if (!(await exists(path.join(dir, `${width}.avif`)))) note(`파일 없음: ${photo.key}/${width}.avif`)
  }
  for (const width of photo.webpWidths) {
    if (!(await exists(path.join(dir, `${width}.webp`)))) note(`파일 없음: ${photo.key}/${width}.webp`)
    if (!photo.widths.includes(width)) note(`${photo.key}: webp 폭 ${width}가 avif 폭에 없다`)
  }
  if (photo.live && !(await exists(path.join(dir, 'live.mp4')))) {
    note(`Live로 표시됐는데 영상이 없음: ${photo.key}`)
  }
  if (photo.widths.some((w) => w > photo.width)) {
    note(`${photo.key}: 원본(${photo.width}px)보다 큰 파생물을 만들었다`)
  }
  if (!photo.lqip.startsWith('data:image/webp;base64,')) note(`${photo.key}: LQIP가 비었거나 형식이 다르다`)
  if (!/^#[0-9a-f]{6}$/.test(photo.color)) note(`${photo.key}: 대표색 형식이 이상하다 (${photo.color})`)
}

// ── 매니페스트에 없는 잔여물이 public/media에 남아있는가 ──
const keys = new Set(PHOTOS.map((p) => p.key))
for (const entry of await readdir(MEDIA_DIR).catch(() => [])) {
  if (!keys.has(entry)) note(`매니페스트에 없는 미디어 디렉터리: public/media/${entry}`)
}

// ── 사람이 쓸 것을 다 썼는가 ──────────────────────────────
const slugs = new Map<string, string>()
for (const photo of PHOTOS) {
  const meta = PHOTO_META[photo.key]
  if (!meta) {
    note(`메타데이터 없음: ${photo.key}`)
    continue
  }
  if (!meta.title?.trim()) note(`제목 없음: ${photo.key}`)
  if (!meta.alt?.trim()) note(`대체텍스트 없음: ${photo.key}`)
  if (!meta.caption?.trim()) note(`캡션 없음: ${photo.key}`)

  const slug = meta.slug ?? photo.key
  const taken = slugs.get(slug)
  if (taken) note(`슬러그 중복 "${slug}": ${taken}, ${photo.key}`)
  else slugs.set(slug, photo.key)

  if (!photo.exif.shotDate && !meta.shotDate) {
    note(`${photo.key}: EXIF에 촬영일이 없는데 보정값도 없다 — 어느 구간에도 못 들어간다`)
  }
}
for (const key of Object.keys(PHOTO_META)) {
  if (!keys.has(key)) note(`매니페스트에 없는 프레임의 메타데이터: ${key}`)
}

// ── 모든 사진이 노선 하나에 정확히 들어가는가 ─────────────
for (const photo of PHOTOS) {
  const date = photo.exif.shotDate || PHOTO_META[photo.key]?.shotDate || ''
  const hits = ROUTES.filter((r) => date >= r.from && date <= r.to)
  if (hits.length === 0) note(`${photo.key} (${date || '날짜 없음'})가 어느 노선에도 속하지 않는다`)
  if (hits.length > 1) note(`${photo.key}가 여러 노선에 걸린다: ${hits.map((r) => r.slug).join(', ')}`)
}

// ── 결과 ──────────────────────────────────────────────────
if (problems.length > 0) {
  console.error(`✗ ${problems.length}건\n`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exitCode = 1
} else {
  const live = PHOTOS.filter((p) => p.live).length
  console.log(`✓ ${PHOTOS.length}프레임 (Live ${live}) · 노선 ${ROUTES.length} — 어긋난 곳 없음`)
}
