'use client'

import { useEffect, useRef } from 'react'
import styles from './transit-strip.module.css'

/**
 * 노선을 가로로 통과하게 만드는 얇은 층.
 *
 * 세 가지만 한다 — 세로 휠을 가로 이동으로 옮기고, 지금 어디쯤인지를 CSS 변수로 흘리고,
 * 구간 경계가 레일의 어디에 오는지를 실측해 눈금을 놓는다.
 *
 * 프레임과 레일은 전부 서버에서 그려져 props로 넘어온다. 사진 데이터는 클라이언트로
 * 한 바이트도 오지 않는다 — GL 레이어와 같은 규칙이다.
 */
export function TransitScroller({
  children,
  rail,
  label,
}: {
  children: React.ReactNode
  rail: React.ReactNode
  label: string
}) {
  const field = useRef<HTMLDivElement>(null)
  const strip = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = field.current
    const element = strip.current
    if (!wrap || !element) return

    const span = () => element.scrollWidth - element.clientWidth

    const report = () => {
      const total = span()
      wrap.style.setProperty('--progress', total > 0 ? (element.scrollLeft / total).toFixed(4) : '0')
    }

    /*
     * 구간 눈금의 자리는 실측한다. 사진 장수로 비례 배분하면 구분 카드 폭과 간격이
     * 빠져 눈금이 실제 경계에서 어긋난다.
     */
    const placeTicks = () => {
      const marks = [...element.querySelectorAll<HTMLElement>('[data-leg-mark]')]
      const ticks = [...wrap.querySelectorAll<HTMLElement>('[data-leg-tick]')]
      const total = element.scrollWidth
      if (total <= 0) return
      marks.forEach((mark, i) => {
        const tick = ticks[i]
        if (tick) tick.style.left = `${((mark.offsetLeft / total) * 100).toFixed(3)}%`
      })
    }

    /*
     * 일반 마우스에는 가로 휠이 없다. 그대로 두면 이 화면은 트랙패드 사용자만
     * 통과할 수 있고, 세로로 굴리면 스트립과 페이지가 동시에 조금씩 움직여 뭉갠다.
     */
    const onWheel = (event: WheelEvent) => {
      // 트랙패드의 진짜 가로 스와이프는 건드리지 않는다. 브라우저가 이미 옳게 처리한다.
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return

      const total = span()
      if (total <= 0) return

      /*
       * 양 끝에 닿으면 놓아준다. 더 밀어도 안 움직이는데 이벤트를 계속 먹으면
       * 페이지가 잠긴 것처럼 느껴진다.
       */
      const atStart = element.scrollLeft <= 0 && event.deltaY < 0
      const atEnd = element.scrollLeft >= total - 1 && event.deltaY > 0
      if (atStart || atEnd) return

      event.preventDefault()
      element.scrollLeft += event.deltaY
    }

    const measure = () => {
      report()
      placeTicks()
    }

    measure()
    // 사진이 늦게 도착하면 스트립 폭이 바뀐다. 그때 눈금도 다시 놓는다.
    const observer = new ResizeObserver(measure)
    observer.observe(element)

    element.addEventListener('scroll', report, { passive: true })
    // preventDefault를 쓰므로 passive일 수 없다.
    element.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      observer.disconnect()
      element.removeEventListener('scroll', report)
      element.removeEventListener('wheel', onWheel)
    }
  }, [])

  return (
    <div ref={field} className={styles.field}>
      <div
        ref={strip}
        className={styles.strip}
        /*
         * 스크롤 이동을 왜곡으로 받는 유일한 자리.
         *
         * 아카이브 인덱스는 읽는 화면이라 굴리는 내내 사진이 일렁이면 안 된다.
         * 여기는 가로로 통과하는 것 자체가 주제이므로 이동이 곧 내용이다.
         */
        data-gl-motion=""
        // 키보드로도 통과할 수 있어야 한다. 포커스를 받으면 방향키가 그대로 동작한다.
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        {children}
      </div>
      {rail}
    </div>
  )
}
