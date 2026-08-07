/**
 * 노선 도면 칸마다 지도 그림을 한 장씩 구워 `public/basemap/`에 둔다.
 *
 *   pnpm basemaps          없는 것만
 *   pnpm basemaps --force  전부 다시
 *
 * 방문자에게는 `<img>` 한 장만 간다 — 런타임에 지도 라이브러리도 타일 요청도 없다.
 * ingest와 같은 규칙이다: 밖에서 받아오는 일은 전부 여기서 끝내고 결과만 커밋한다.
 */
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { sheet } from '../src/lib/geo'
import { ROUTE_LIST } from '../src/lib/photos'
import { BOX, PAD, gps, plotCells } from '../src/lib/plot-cells'
import { bakeBasemap } from './lib/basemap'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'public', 'basemap')

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  )

async function main() {
  const force = process.argv.includes('--force')
  await mkdir(OUT_DIR, { recursive: true })

  const wanted = new Set<string>()
  let baked = 0
  let skipped = 0
  let bytes = 0

  for (const route of ROUTE_LIST) {
    for (const cell of plotCells(route)) {
      const file = path.join(OUT_DIR, `${cell.id}.webp`)
      wanted.add(`${cell.id}.webp`)

      if (!force && (await exists(file))) {
        skipped += 1
        bytes += (await stat(file)).size
        continue
      }

      const plan = sheet(
        cell.photos.map((p) => gps(p)!),
        BOX.w,
        BOX.h,
        PAD,
      )
      const { data, zoom, tiles } = await bakeBasemap(plan, BOX.w, BOX.h)
      await writeFile(file, data)
      baked += 1
      bytes += data.byteLength

      process.stdout.write(
        `  ${cell.id.padEnd(22)} z${String(zoom).padStart(2)} · 타일 ${String(tiles).padStart(2)} · ${(data.byteLength / 1024).toFixed(0)}KB\n`,
      )
    }
  }

  // 노선이나 구간이 바뀌면 쓰이지 않는 그림이 남는다. 매니페스트가 없는 자산이라 여기서 치운다.
  let removed = 0
  for (const name of await readdir(OUT_DIR).catch(() => [])) {
    if (wanted.has(name)) continue
    await rm(path.join(OUT_DIR, name), { force: true })
    removed += 1
  }

  console.log(
    `\n✓ ${wanted.size}칸 — 새로 구움 ${baked}, 건너뜀 ${skipped}${removed ? `, 치움 ${removed}` : ''} · ${(bytes / 1_048_576).toFixed(1)}MB`,
  )
}

main().catch((error) => {
  console.error('✗ 지도를 굽지 못했다:', error)
  process.exitCode = 1
})
