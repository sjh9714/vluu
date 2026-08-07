import { GlCanvas } from '@/components/gl-canvas'
import { LiveLayer } from '@/components/live-layer'

/**
 * 사이트 라우트들이 공유하는 셸.
 *
 * 캔버스가 여기 있는 이유는 라우트보다 오래 살아야 하기 때문이다.
 * 페이지가 바뀌는 동안에도 WebGL 컨텍스트와 GPU에 올라간 텍스처가 유지된다.
 *
 * 사진 데이터는 넘기지 않는다 — GL은 필요한 걸 전부 DOM에서 읽는다.
 * 처음에는 68장의 매니페스트를 props로 내려보냈는데, 그러면 모든 페이지가
 * 100KB짜리 JSON을 파싱하느라 메인 스레드를 수백 ms씩 잡아먹는다.
 *
 * `LiveLayer`도 같은 이유로 여기 있다. 라우트가 바뀌어도 하나뿐인 `<video>`를
 * 다시 만들지 않고, 프레임 사이를 옮겨 다니기만 한다.
 *
 * `modal`은 병렬 라우트 슬롯이다. 인덱스에서 사진을 누르면 `@modal/(.)p/[slug]`가
 * `/p/[slug]`를 가로채 이 자리에 겹쳐 열리고, 그동안 `children`(인덱스)은 언마운트되지
 * 않는다. 공유 링크나 새로고침 같은 하드 내비게이션에서는 가로채기가 걸리지 않고
 * 전체 페이지가 그대로 뜬다.
 */
export default function SiteLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {/* 모달이 열리면 이 컨테이너에 inert가 붙어 배경 전체가 포커스에서 빠진다. */}
      <div id="page-root">{children}</div>
      {modal}
      <GlCanvas />
      <LiveLayer />
    </>
  )
}
