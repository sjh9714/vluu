import { IndexGrid } from '@/components/index-grid'
import { Opening } from '@/components/opening'
import { OpeningBanner } from '@/components/opening-banner'
import { SiteHeader } from '@/components/site-header'
import { PageTransition } from '@/components/page-transition'
import { FRAME_TOTAL, ROUTE_LIST } from '@/lib/photos'
import styles from '@/components/index-grid.module.css'

export default function IndexPage() {
  return (
    <>
      <Opening />
      <SiteHeader current="index" />
      <PageTransition>
      <main className={styles.index}>
        {/*
          여는 띠. 전폭이라 거터 밖에 있고, 제목은 그 아래로 내려간다.
          한 장을 크게 놓는 버전을 먼저 만들었는데 별로였다 — 배너는 흘러야 배너다.
        */}
        <OpeningBanner routes={ROUTE_LIST} />

        <div className={`${styles.intro} vluu-open-3`}>
          <h1>The whole catalogue</h1>
          <p>
            {FRAME_TOTAL} frames from {ROUTE_LIST.length} trips, oldest first.
          </p>
        </div>
        <IndexGrid routes={ROUTE_LIST} />
      </main>
        </PageTransition>
    </>
  )
}
