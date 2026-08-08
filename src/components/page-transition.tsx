'use client'

import * as React from 'react'

/**
 * 화면을 옮길 때 방향이 생긴다.
 *
 * 지금까지 인덱스↔노선 이동은 하드 컷이었다. 앞으로 갔는지 돌아왔는지가 화면에
 * 아무 흔적도 남기지 않으면, 사람은 매번 어디에 있는지 다시 읽어야 한다.
 *
 * 브라우저의 View Transitions API를 React가 감싼 것을 쓴다. **전환은 컴포지터에서
 * 돈다** — 이 사이트에서 걷어낸 모션은 전부 메인 스레드가 컴포지터를 쫓다 진 것들이라,
 * 그 실패를 구조적으로 반복할 수 없는 쪽을 고른 것이다.
 *
 * 방향은 자동으로 정해지지 않는다. 어떤 링크가 "안으로"이고 어떤 링크가 "밖으로"인지는
 * 이 사이트의 구조를 아는 사람이 정해야 한다 — `nav-forward` / `nav-back`.
 * 타입이 없는 이동(브라우저 뒤로가기, 모달 열기)은 `default: 'none'`이라 아무 일도 없다.
 */

/*
 * `ViewTransition`은 Next이 vendor한 React에는 있지만 설치된 react@19.2.8의 타입에는
 * 아직 없다. 런타임에는 Next이 react를 자기 사본으로 별칭하므로 정상 동작한다 —
 * 타입만 여기서 한 번 좁혀두고, 정식 타입이 오면 이 줄만 지우면 된다.
 */
const ViewTransition = (React as unknown as {
  ViewTransition: React.ComponentType<{
    children: React.ReactNode
    enter?: Record<string, string>
    exit?: Record<string, string>
    default?: string
  }>
}).ViewTransition

export function PageTransition({ children }: { children: React.ReactNode }) {
  // 못 받는 환경에서는 그냥 지금 화면이다. 전환은 덧칠이지 구조가 아니다.
  if (!ViewTransition) return <>{children}</>

  return (
    <ViewTransition
      enter={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
      exit={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
      default="none"
    >
      {children}
    </ViewTransition>
  )
}
