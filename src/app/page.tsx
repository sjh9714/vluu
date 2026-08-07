import { SELECTED, EXCLUDED, TOTAL_FRAMES } from '#content/selection'
import styles from './page.module.css'

/**
 * Phase 0 홀딩 페이지.
 * Phase 2에서 ATLAS(무한 드래그 캔버스)로 교체된다.
 * 지금은 셸·토큰·폰트·콘텐츠 모듈이 실제로 연결됐는지만 증명한다.
 */
export default function Home() {
  return (
    <main className={styles.shell}>
      <h1 className={styles.wordmark}>VLUU</h1>

      <p className={styles.statement}>
        A photographic index of transit edges, civic geometry, and the light between them.{' '}
        <em>Currently being rebuilt from the ground up.</em>
      </p>

      <p className={styles.state}>
        <span>
          Selected <b>{SELECTED.length}</b>
        </span>
        <span>
          Cut <b>{Object.keys(EXCLUDED).length}</b>
        </span>
        <span>
          Shot <b>{TOTAL_FRAMES}</b>
        </span>
        <span>
          Phase <b>0</b> — scaffold
        </span>
      </p>
    </main>
  )
}
