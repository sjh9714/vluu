import Link from 'next/link'
import { SiteHeader } from '@/components/site-header'

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main
        style={{
          display: 'grid',
          placeItems: 'start',
          gap: 'var(--s-4)',
          padding: 'var(--s-9) var(--gutter)',
          maxWidth: 'var(--measure)',
        }}
      >
        <h1 style={{ fontSize: 'var(--t-h1)' }}>Not on any route</h1>
        <p style={{ color: 'var(--ink-mute)' }}>
          That address does not lead to a frame. The index has all of them.
        </p>
        <Link
          href="/"
          style={{
            fontFamily: 'var(--face-mono)',
            fontSize: 'var(--t-micro)',
            letterSpacing: 'var(--tr-label)',
            textTransform: 'uppercase',
            borderBottom: '1px solid currentColor',
            paddingBottom: 2,
          }}
        >
          Back to the index
        </Link>
      </main>
    </>
  )
}
