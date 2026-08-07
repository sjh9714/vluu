import { CAMERAS, PHOTO_LIST, ROUTE_LIST } from '@/lib/photos'
import styles from './page.module.css'

/**
 * Phase 1 홀딩 페이지.
 * Phase 2에서 ATLAS(무한 드래그 캔버스)로 교체된다.
 * 지금은 콘텐츠 레이어가 앱까지 실제로 연결됐는지를 증명한다.
 */
export default function Home() {
  const live = PHOTO_LIST.filter((photo) => photo.live).length

  return (
    <main className={styles.shell}>
      <h1 className={styles.wordmark}>VLUU</h1>

      <p className={styles.statement}>
        A photographic index of transit edges, civic geometry, and the light between them.{' '}
        <em>Currently being rebuilt from the ground up.</em>
      </p>

      <p className={styles.state}>
        <span>
          Frames <b>{PHOTO_LIST.length}</b>
        </span>
        <span>
          Live <b>{live}</b>
        </span>
        <span>
          Routes <b>{ROUTE_LIST.length}</b>
        </span>
        <span>
          Cameras <b>{CAMERAS.length}</b>
        </span>
        <span>
          Phase <b>1</b> — pipeline
        </span>
      </p>
    </main>
  )
}
