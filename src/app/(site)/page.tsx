import { IndexGrid } from '@/components/index-grid'
import { SiteHeader } from '@/components/site-header'
import { FRAME_TOTAL, ROUTE_LIST } from '@/lib/photos'
import styles from '@/components/index-grid.module.css'

export default function IndexPage() {
  const legs = ROUTE_LIST.reduce((n, route) => n + route.legs.length, 0)

  return (
    <>
      <SiteHeader current="index" />
      <main className={styles.index}>
        <div className={styles.intro}>
          <h1>The whole catalogue</h1>
          <p>
            {FRAME_TOTAL} frames from {ROUTE_LIST.length} trips, filed by the day they were taken —{' '}
            {legs} of them. Nothing is ranked and nothing is featured; the order is simply the order it
            happened in. Pick a frame, or follow a route from end to end.
          </p>
        </div>
        <IndexGrid routes={ROUTE_LIST} />
      </main>
    </>
  )
}
