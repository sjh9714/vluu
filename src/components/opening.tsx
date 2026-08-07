'use client'

import { useEffect } from 'react'

/**
 * 열릴 때의 한 장면.
 *
 * 수상작들의 첫 화면은 주장이다. 여기 있던 건 헤더와 격자가 그냥 서 있는 화면이었다.
 * 도면이 그려지듯 크롬이 조립된다 — 이 사이트가 셰이더 주석에 써둔 "측량 도구의
 * 정밀함"과 같은 결이다.
 *
 * **사진은 건드리지 않는다.** LCP가 0.6초인 건 첫 화면 사진이 곧바로 칠해지기
 * 때문이고, 거기에 페이드를 걸면 그 숫자가 무너진다. 68장을 동시에 애니메이션하는 건
 * 조사에서 읽은 그 문장 — "프레임 떨구는 아름다움은 입상 못 한다" — 에 정확히 걸린다.
 * 움직이는 건 헤어라인과 글자 몇 개뿐이고 전부 transform/opacity다.
 *
 * 애니메이션은 **CSS가 첫 페인트부터** 돌린다. 여기서 클래스를 붙여 시작하면
 * 하이드레이션 전까지 최종 상태로 있다가 그때서야 되감기는 게 보인다.
 * 이 컴포넌트가 하는 일은 반대다 — 끝난 뒤에 다시 안 돌게 막는 것.
 */

/**
 * 이 문서에서 이미 한 번 돌았는가.
 *
 * 모듈 수준이라 클라이언트 내비게이션을 넘어 산다. 인덱스로 돌아올 때마다 다시
 * 조립되면 그게 제일 빨리 질린다. 새로고침에는 다시 돈다 — 그건 새 방문이다.
 */
let played = false

/** CSS가 쓰는 길이와 같아야 한다. 더 짧으면 도중에 끊기고, 길면 그만큼 늦게 잠근다. */
const OPENING_MS = 700

export function Opening() {
  useEffect(() => {
    const html = document.documentElement

    if (played) {
      html.dataset['opened'] = ''
      return
    }

    const timer = window.setTimeout(() => {
      played = true
      html.dataset['opened'] = ''
    }, OPENING_MS)

    return () => window.clearTimeout(timer)
  }, [])

  return null
}
