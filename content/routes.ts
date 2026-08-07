/**
 * 노선 = 여행 하나. 구간 = 하루.
 *
 * 어느 프레임이 어느 노선에 속하는지는 촬영일이 정한다 — 손으로 목록을 관리하지 않는다.
 * 사진이 늘어도 날짜만 맞으면 알아서 붙고, 니콘 사진이 합류해도 같은 규칙이 돈다.
 *
 * 구간 제목만 손으로 쓴다. 날짜는 언제였는지는 말해주지만 어디였는지는 말해주지 않는다.
 */

export interface RouteDef {
  readonly slug: string
  readonly title: string
  readonly intro: string
  /** 이 노선에 속하는 날짜 범위 (양끝 포함). */
  readonly from: string
  readonly to: string
  /** 구간 제목. 키는 `YYYY-MM-DD`. 빠진 날짜는 날짜 자체를 제목으로 쓴다. */
  readonly legTitles: Readonly<Record<string, string>>
}

export const ROUTES: readonly RouteDef[] = [
  {
    slug: 'ganghwa',
    title: 'Ganghwa',
    intro:
      'One afternoon on an island west of Seoul, in a yard where everything had already been something else. The oldest frames here, and the only ones not shot in Japan.',
    from: '2022-09-01',
    to: '2022-09-30',
    legTitles: {
      '2022-09-15': 'Salvage yard',
    },
  },
  {
    slug: 'kansai',
    title: 'Kansai',
    intro:
      'December in Osaka and Kyoto. Short days, low sun, and vermilion turning up everywhere — on lamps, on eaves, on ten thousand gates.',
    from: '2023-12-01',
    to: '2023-12-31',
    legTitles: {
      '2023-12-11': 'Osaka, lanterns first',
      '2023-12-13': 'Kyoto, river to hillside',
      '2023-12-14': 'The gates after dark',
    },
  },
  {
    slug: 'kanto',
    title: 'Kantō',
    intro:
      'A week in January with a sky that never clouded over. Tokyo by river and elevated rail, then west to the crater lake, then back down to the harbour. Most of what is here.',
    from: '2025-01-01',
    to: '2025-01-31',
    legTitles: {
      '2025-01-09': 'Asakusa to the bay',
      '2025-01-10': 'Slopes, alleys, tiled walls',
      '2025-01-12': 'Shrines, then neon',
      '2025-01-13': 'Romancecar to Lake Ashi',
      '2025-01-14': 'Yokohama, day into night',
    },
  },
]
