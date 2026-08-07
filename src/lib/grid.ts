/**
 * 인덱스 그리드의 치수.
 *
 * 이 셀렉은 68장이 전부 정확히 3:4다. 보통 사진 그리드가 들쭉날쭉한 건 비율이
 * 제각각이기 때문인데 여기는 그렇지 않으므로, **균일 그리드는 타협이 아니라
 * 재료에 맞는 선택**이다. 모든 셀이 같은 크기이므로 행 정렬은 CSS Grid가
 * 공짜로 주고, 이 모듈이 할 일은 브라우저에게 셀 폭을 정확히 알려주는 것뿐이다.
 *
 * (WebGL 레이어는 이 모듈을 쓰지 않는다. `src/gl/stage.ts`는 DOM 엘리먼트의
 * getBoundingClientRect()를 직접 읽으므로 배치가 어떻게 바뀌든 그대로 따라온다.)
 */

/** 뷰포트 구간별 열 수. 넓은 쪽부터. */
export const COLUMNS = [
  { minWidth: 900, columns: 5 },
  { minWidth: 640, columns: 3 },
  { minWidth: 0, columns: 2 },
] as const

/** 그리드 좌우 여백(`--gutter`)의 최대값. `sizes` 계산에서 빼줘야 하는 몫이다. */
const GUTTER_MAX = 56
/** 열 사이 간격(`--grid-gap`)의 최대값. */
const GAP_MAX = 28

/**
 * 브라우저에게 넘길 `sizes` 문자열.
 *
 * 뷰포트를 열 수로 그냥 나누면 좌우 여백과 열 사이 간격을 빼먹게 되고,
 * 브라우저가 한 단계 큰 파일을 고른다. 68장이면 그 차이가 곧 수백 KB다.
 * 여백을 calc로 되돌려준다.
 */
export function gridSizes(): string {
  const clause = ({ columns }: { columns: number }) => {
    const overhead = Math.round((GUTTER_MAX * 2 + GAP_MAX * (columns - 1)) / columns)
    return `calc(${(100 / columns).toFixed(2)}vw - ${overhead}px)`
  }

  const [wide, mid, narrow] = COLUMNS
  return [
    `(min-width: ${wide.minWidth}px) ${clause(wide)}`,
    `(min-width: ${mid.minWidth}px) ${clause(mid)}`,
    clause(narrow),
  ].join(', ')
}

/** 세 자리로 맞춘 프레임 번호. `1` → `001` */
export function frameLabel(n: number): string {
  return String(n).padStart(3, '0')
}
