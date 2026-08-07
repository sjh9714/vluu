import { IndexGrid } from '@/components/index-grid'
import { SiteHeader } from '@/components/site-header'
import { FRAME_TOTAL, ROUTE_LIST } from '@/lib/photos'
import styles from '@/components/index-grid.module.css'

export default function IndexPage() {
  return (
    <>
      <SiteHeader current="index" />
      <main className={styles.index}>
        {/*
          한 줄이면 된다. 여기 있던 문단은 사진 얘기가 아니라 정렬 규칙을 변호하는 말이었다 —
          "무엇도 순위를 매기지 않았고 무엇도 내세우지 않았다" 같은 것. 보러 온 사람이
          묻지 않은 것에 답하고 있었다.
        */}
        <div className={styles.intro}>
          <h1>The whole catalogue</h1>
          <p>
            {FRAME_TOTAL} frames from {ROUTE_LIST.length} trips, oldest first.
          </p>
        </div>
        <IndexGrid routes={ROUTE_LIST} />
      </main>
    </>
  )
}
