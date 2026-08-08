import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { PageTransition } from '@/components/page-transition'
import { TransitStrip } from '@/components/transit-strip'
import { ROUTE_LIST, getRoute } from '@/lib/photos'

export function generateStaticParams() {
  return ROUTE_LIST.map((route) => ({ slug: route.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const route = getRoute((await params).slug)
  if (!route) return {}
  return { title: route.title, description: route.intro }
}

export default async function RoutePage({ params }: { params: Promise<{ slug: string }> }) {
  const route = getRoute((await params).slug)
  if (!route) notFound()

  return (
    <>
      <SiteHeader current={route.slug} />
      <PageTransition>
      <main>
        <TransitStrip route={route} />
      </main>
        </PageTransition>
    </>
  )
}
