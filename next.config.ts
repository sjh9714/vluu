import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 이미지는 ingest 파이프라인이 미리 AVIF/WebP 반응형 세트로 굽는다.
  // 런타임 최적화기를 태울 게 없으므로 next/image는 쓰지 않고 순수 <img srcset>을 쓴다.
  images: { unoptimized: true },
  typedRoutes: true,
}

export default nextConfig
