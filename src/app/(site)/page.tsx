import { IndexGrid } from '@/components/index-grid'
import { Opening } from '@/components/opening'
import { OpeningFrame } from '@/components/opening-frame'
import { SiteHeader } from '@/components/site-header'
import { PageTransition } from '@/components/page-transition'
import { FRAME_TOTAL, PHOTO_LIST, ROUTE_LIST, frameNumber } from '@/lib/photos'
import styles from '@/components/index-grid.module.css'

export default function IndexPage() {
  /*
   * 가장 최근에 찍은 한 장으로 연다. 고르는 게 아니라 규칙이라, 사진이 늘면
   * 저절로 바뀌고 이 자리가 "대표작"이 되지 않는다.
   */
  const latest = PHOTO_LIST.at(-1)

  return (
    <>
      <Opening />
      <SiteHeader current="index" />
      <PageTransition>
      <main className={styles.index}>
        <div className="vluu-open-3">
          {latest ? (
            <OpeningFrame photo={latest} number={frameNumber(latest.slug)} total={FRAME_TOTAL} />
          ) : null}
        </div>
        <IndexGrid routes={ROUTE_LIST} />
      </main>
        </PageTransition>
    </>
  )
}
