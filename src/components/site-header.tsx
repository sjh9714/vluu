import Link from 'next/link'
import { PHOTO_LIST, ROUTE_LIST } from '@/lib/photos'
import styles from './site-header.module.css'

/**
 * 사이트 크롬. 헤어라인 한 줄과 텍스트뿐이다 —
 * 화면에서 색을 갖는 건 사진뿐이라는 규칙이 여기에도 적용된다.
 */
export function SiteHeader({ current }: { current?: string }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark}>
        VLUU
      </Link>

      <nav className={styles.nav} aria-label="Routes">
        <Link href="/" aria-current={current === 'index' ? 'page' : undefined}>
          Index
        </Link>
        {ROUTE_LIST.map((route) => (
          <Link
            key={route.slug}
            href={`/c/${route.slug}`}
            aria-current={current === route.slug ? 'page' : undefined}
          >
            {route.title}
          </Link>
        ))}
        <Link href="/colophon" aria-current={current === 'colophon' ? 'page' : undefined}>
          Colophon
        </Link>
      </nav>

      <span className={styles.spacer} />
      <span className={styles.count}>{PHOTO_LIST.length} frames</span>
    </header>
  )
}
