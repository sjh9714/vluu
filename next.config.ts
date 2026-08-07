import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 이미지는 ingest 파이프라인이 미리 AVIF/WebP 반응형 세트로 굽는다.
  // 런타임 최적화기를 태울 게 없으므로 next/image는 쓰지 않고 순수 <img srcset>을 쓴다.
  images: { unoptimized: true },
  typedRoutes: true,
  // dev 서버는 localhost로 뜨는데 Playwright와 스크린샷은 127.0.0.1로 붙는다.
  // Next 16은 이걸 교차 출처로 보고 _next 청크를 403으로 막아 하이드레이션이 통째로 죽는다.
  // SSR된 화면은 멀쩡해 보여서 알아채기 어렵다.
  allowedDevOrigins: ['127.0.0.1'],
  /*
   * public/ 의 기본 헤더는 `max-age=0, must-revalidate`다. 사진 파생물 71MB를
   * 매번 재검증하게 둘 이유가 없다.
   *
   * 엣지는 1년으로 길게 잡는다 — 새 배포가 CDN을 무효화하므로 낡은 바이트가 남지 않는다.
   * 브라우저는 하루만 준다. 브라우저 캐시는 배포로 지워지지 않고, 파일 이름에 내용 해시가
   * 없어서 `pnpm ingest --force`로 다시 구우면 **같은 주소에 다른 바이트**가 온다.
   * 같은 이유로 immutable은 쓰지 않는다.
   */
  async headers() {
    return [
      {
        // 지도 그림도 같은 규칙이다 — 구워둔 정적 자산이고 이름에 해시가 없다.
        source: '/basemap/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, s-maxage=31536000' },
        ],
      },
      {
        source: '/media/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, s-maxage=31536000' },
        ],
      },
    ]
  },
}

export default nextConfig
