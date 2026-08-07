import type { Metadata, Viewport } from 'next'
import { display, mono } from '@/styles/fonts'
import { siteUrl } from '@/lib/site-url'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: { default: 'VLUU', template: '%s — VLUU' },
  description:
    'A photographic index of transit edges, civic geometry, and the light between them.',
  metadataBase: new URL(siteUrl()),
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
