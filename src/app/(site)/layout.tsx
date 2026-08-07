import { GlCanvas } from '@/components/gl-canvas'

/**
 * 사이트 라우트들이 공유하는 셸.
 *
 * 캔버스가 여기 있는 이유는 라우트보다 오래 살아야 하기 때문이다.
 * 페이지가 바뀌는 동안에도 WebGL 컨텍스트와 GPU에 올라간 텍스처가 유지된다.
 *
 * 사진 데이터는 넘기지 않는다 — GL은 필요한 걸 전부 DOM에서 읽는다.
 * 처음에는 68장의 매니페스트를 props로 내려보냈는데, 그러면 모든 페이지가
 * 100KB짜리 JSON을 파싱하느라 메인 스레드를 수백 ms씩 잡아먹는다.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GlCanvas />
    </>
  )
}
