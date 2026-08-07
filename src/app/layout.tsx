import type { Metadata, Viewport } from 'next'
import { display, mono } from '@/styles/fonts'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: { default: 'VLUU', template: '%s — VLUU' },
  description:
    'A photographic index of transit edges, civic geometry, and the light between them.',
  // 폴백 포트는 이 프로젝트의 dev 포트와 같아야 한다. robots·sitemap도 같은 값을 본다.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:4321'),
}

export const viewport: Viewport = {
  // 화이트 큐브는 단일 세계로 간다. 다크 대응은 의도적으로 만들지 않는다.
  colorScheme: 'light',
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div id="main">{children}</div>
      </body>
    </html>
  )
}
