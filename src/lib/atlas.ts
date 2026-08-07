/**
 * ATLAS 레이아웃의 수학.
 *
 * DOM(Phase 2)과 WebGL(Phase 3)이 **같은 함수**를 쓴다. GL은 DOM 엘리먼트의
 * 실제 좌표를 읽어 그리므로, 둘이 어긋나면 캔버스를 껐다 켤 때 사진이 튄다.
 * 그래서 배치 규칙은 컴포넌트가 아니라 여기에 둔다 — 순수 함수, 테스트 가능.
 *
 * 이 셀렉은 68장이 전부 3:4 세로다. 균일 그리드로 깔면 68번 같은 직사각형이
 * 반복되므로, 변화를 만드는 건 비율이 아니라 **크기 차이와 여백**이어야 한다.
 */

/** 데스크톱 그리드의 칼럼 수. */
export const ATLAS_COLUMNS = 12

/**
 * 칼럼 점유 폭의 주기. 합이 12의 배수가 아니라서(35) 줄마다 다른 조합이 생기고,
 * 눈에 띄는 반복 없이 계속 굴러간다.
 */
const SPAN_CYCLE = [3, 2, 4, 3, 2, 3, 4, 2, 3, 2, 4, 3] as const

/** 세로로 밀어내는 정도의 주기. 줄의 밑변을 깨서 '테이블 위에 놓인 인화지'처럼 만든다. */
const DRIFT_CYCLE = [0, 0.34, 0.12, 0.55, 0.2, 0.42, 0.06, 0.28] as const

export interface AtlasCell {
  /** 12칼럼 중 몇 칸을 차지하는지. 2–4. */
  readonly span: number
  /** 위에서 얼마나 내려 앉는지. 0–1, 셀 폭에 대한 비율. */
  readonly drift: number
}

export function atlasCell(index: number): AtlasCell {
  const span = SPAN_CYCLE[index % SPAN_CYCLE.length] ?? 3
  const drift = DRIFT_CYCLE[index % DRIFT_CYCLE.length] ?? 0
  return { span, drift }
}

/**
 * 이 셀이 실제로 렌더될 폭(px). 뷰포트가 아니라 그리드 폭을 받는다.
 * `sizes` 속성과 GL 텍스처 해상도 선택이 같은 값을 보게 하려고 따로 뺐다.
 */
export function cellWidth(gridWidth: number, span: number, gap: number, columns = ATLAS_COLUMNS): number {
  const column = (gridWidth - gap * (columns - 1)) / columns
  return column * span + gap * (span - 1)
}

/**
 * 브라우저에게 넘길 `sizes` 문자열.
 *
 * 그리드에는 좌우 여백(gutter)과 칼럼 사이 간격이 있으므로 셀은 언제나
 * `span/12 × 뷰포트`보다 좁다. 그 차이를 빼주지 않으면 브라우저가 한 단계 큰
 * 파일을 고른다 — 68장이면 그게 곧 수백 KB다. calc로 여백을 되돌려준다.
 */
export function atlasSizes(span: number): string {
  const pct = (n: number, columns: number) => Math.round((n / columns) * 100)
  // 뷰포트에서 빼야 하는 몫: 좌우 gutter + 이 셀이 차지하지 않는 gap들
  const desktop = `calc(${pct(span, ATLAS_COLUMNS)}vw - ${Math.round(112 * (span / ATLAS_COLUMNS)) + 30}px)`
  const mid = `calc(${pct(Math.max(2, Math.floor(span * 0.75)), 8)}vw - 40px)`
  const mobile = `calc(${pct(Math.max(2, Math.floor(span * 0.5)), 4)}vw - 30px)`
  return `(max-width: 720px) ${mobile}, (max-width: 900px) ${mid}, ${desktop}`
}
