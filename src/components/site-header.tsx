import Link from 'next/link'
import { PHOTO_LIST, ROUTE_LIST } from '@/lib/photos'
import styles from './site-header.module.css'

/**
 * 사이트 크롬. 헤어라인 한 줄과 텍스트뿐이다 —
 * 화면에서 색을 갖는 건 사진뿐이라는 규칙이 여기에도 적용된다.
 */
export function SiteHeader({ current }: { current?: string }) {
  return (
    /*
     * 전환 중에도 이 헤더는 움직이지 않는다. 같이 미끄러지면 붙잡을 기준점이 없어져서
     * "내용이 바뀌었다"가 아니라 "화면이 흔들렸다"로 읽힌다.
     */
    <header className={styles.header} style={{ viewTransitionName: 'site-header' }}>
      {/* 여는 장면의 첫 박자 — 이 선이 좌에서 우로 그어진다. */}
      <span className={`${styles.rule} vluu-rule`} aria-hidden="true" />

      <Link href="/" className={`${styles.wordmark} vluu-open-1`}>
        VLUU
      </Link>

      <nav className={`${styles.nav} vluu-open-2`} aria-label="Routes">
        {/* 인덱스는 이 사이트의 바깥이다 — 어디서 오든 돌아가는 방향. */}
        <Link href="/" aria-current={current === 'index' ? 'page' : undefined} transitionTypes={['nav-back']}>
          Index
        </Link>
        {ROUTE_LIST.map((route) => (
          <Link
            key={route.slug}
            href={`/c/${route.slug}`}
            aria-current={current === route.slug ? 'page' : undefined}
            // 노선은 안으로 들어가는 쪽이다.
            transitionTypes={['nav-forward']}
          >
            {route.title}
          </Link>
        ))}
        <Link href="/colophon" aria-current={current === 'colophon' ? 'page' : undefined} transitionTypes={['nav-forward']}>
          Colophon
        </Link>
      </nav>

      <span className={styles.spacer} />
      <span className={`${styles.count} vluu-open-2`}>{PHOTO_LIST.length} frames</span>
    </header>
  )
}
