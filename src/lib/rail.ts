/**
 * 노선 레일 위의 자리.
 *
 * 뷰어가 "지금 어디쯤"을 말할 때 쓴다. 노선 페이지의 레일은 가로 스크롤 위치를
 * 클라이언트가 실측해야 하지만, 뷰어에서는 답이 노선 데이터에 이미 있다 —
 * 몇 번째 사진이고 구간이 어디서 갈리는지. 그래서 서버에서 계산하고 끝낸다.
 *
 * 계산 자체는 나눗셈 몇 번이지만 경계가 여럿이다. 사진이 한 장뿐인 노선,
 * 구간이 하나뿐인 노선, 첫 장, 끝 장 — 그래서 브라우저 없이 흔들어볼 수 있게 여기 둔다.
 */

export interface RailPoints {
  /** 표식 자리. 0이 첫 장, 1이 끝 장. */
  readonly progress: number
  /** 구간 경계. 첫 구간은 항상 0이므로 뺀다 — 레일 왼쪽 끝에 눈금을 겹쳐 그릴 이유가 없다. */
  readonly ticks: readonly number[]
}

/**
 * @param legCounts 구간(=하루)마다 사진 몇 장인지, 순서대로
 * @param at 지금 사진이 노선에서 몇 번째인지 (1부터)
 */
export function railPoints(legCounts: readonly number[], at: number): RailPoints {
  const total = legCounts.reduce((sum, n) => sum + n, 0)

  /*
   * 자리는 **칸이 아니라 눈금 사이**로 잰다. 첫 장이 0, 끝 장이 1이다.
   *
   * `at / total`로 재면 첫 장이 이미 조금 가 있고 끝 장만 1에 닿아, 레일 왼쪽이
   * 늘 비어 보인다. 사진이 한 장이면 나눌 것이 없으므로 0에 둔다 — 시작이자 끝인데
   * 둘 중 하나를 골라야 한다면 시작이다.
   */
  const progress = total > 1 ? clamp((at - 1) / (total - 1)) : 0

  const ticks: number[] = []
  let seen = 0
  for (const count of legCounts) {
    // 첫 구간의 경계는 레일의 시작이다. 눈금으로 그리지 않는다.
    if (seen > 0 && total > 1) ticks.push(clamp(seen / (total - 1)))
    seen += count
  }

  return { progress, ticks }
}

function clamp(n: number): number {
  return Math.min(1, Math.max(0, n))
}
