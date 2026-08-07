import type { MetadataRoute } from 'next'
import { PHOTO_LIST, ROUTE_LIST } from '@/lib/photos'
import { siteUrl } from '@/lib/site-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const BASE = siteUrl()

  return [
    { url: BASE, priority: 1 },
    { url: `${BASE}/colophon`, priority: 0.5 },
    ...ROUTE_LIST.map((route) => ({ url: `${BASE}/c/${route.slug}`, priority: 0.8 })),
    ...PHOTO_LIST.map((photo) => ({
      url: `${BASE}/p/${photo.slug}`,
      priority: 0.6,
      // 사진 자체는 바뀌지 않는다. 마지막 변경은 촬영일로 둔다.
      lastModified: photo.exif.shotDate || undefined,
    })),
  ]
}
