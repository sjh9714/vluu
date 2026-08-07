import { AtlasGrid } from '@/components/atlas-grid'
import { SiteHeader } from '@/components/site-header'
import { PHOTO_LIST, ROUTE_LIST } from '@/lib/photos'
import styles from '@/components/atlas-grid.module.css'

/**
 * ATLAS — 전체 인덱스.
 * Phase 3에서 이 위에 WebGL 무한 평면이 얹힌다. 캔버스를 끄면 이 화면으로 돌아온다.
 */
export default function IndexPage() {
  const first = PHOTO_LIST[0]?.exif.shotDate
  const last = PHOTO_LIST.at(-1)?.exif.shotDate

  return (
    <>
      <SiteHeader current="index" />
      <main>
        <div className={styles.intro}>
          <h1>Everything, at once</h1>
          <p>
            {PHOTO_LIST.length} frames from {ROUTE_LIST.length} trips
            {first && last ? `, ${first.slice(0, 4)} to ${last.slice(0, 4)}` : null}. Shot on a phone,
            in the gaps between going somewhere and arriving. Pick one, or take a route.
          </p>
        </div>
        <AtlasGrid photos={PHOTO_LIST} />
      </main>
    </>
  )
}
