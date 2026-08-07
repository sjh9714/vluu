import type { GlStage } from './stage'

/**
 * 캔버스 밖에서 GL 레이어를 만질 수 있는 좁은 창구.
 *
 * 셰이더 안에서 벌어지는 일은 스크린샷으로도 DOM 단언으로도 잡히지 않는다.
 * Colophon의 uniform 슬라이더와 e2e가 같은 문을 쓰도록 여기 하나만 열어둔다 —
 * 테스트 전용 후크를 따로 만들면 그건 제품이 아니라 테스트를 검사하게 된다.
 */
export interface GlHandle {
  setIntensity(value: number): void
  inspect(): ReturnType<GlStage['inspect']>
  /**
   * 이 사진이 지금 있는 자리를 기억해둔다. 다음 화면에서 거기서부터 이어 그린다.
   *
   * 열 때는 GL이 클릭을 직접 듣고 알아서 부르지만, 닫을 때는 계기가 DOM 밖에 있다 —
   * Esc, 베일 클릭, 닫기 버튼. 그래서 모달이 사라지기 전에 자기 자리를 넘겨줘야 한다.
   */
  beginMorph(key: string, from: DOMRect): void
}

declare global {
  interface Window {
    __vluuGl?: GlHandle
  }
}

export function publishHandle(stage: GlStage): void {
  window.__vluuGl = {
    setIntensity: (value) => stage.setIntensity(value),
    inspect: () => stage.inspect(),
    beginMorph: (key, from) => stage.beginMorph(key, from),
  }
}

export function revokeHandle(): void {
  delete window.__vluuGl
}
