'use client'

import { useEffect, useRef } from 'react'
import styles from './transit-strip.module.css'

/**
 * 노선을 가로로 통과하게 만드는 얇은 층.
 *
 * 네 가지만 한다 — 세로 휠을 가로 이동으로 옮기고, 지금 어디쯤인지를 CSS 변수로 흘리고,
 * 구간 경계가 레일의 어디에 오는지를 실측해 눈금을 놓고, 지금 가운데 있는 프레임을
 * 도면에 표시한다.
 *
 * 프레임과 레일과 도면은 전부 서버에서 그려져 props로 넘어온다. 사진 데이터는 클라이언트로
 * 한 바이트도 오지 않는다 — GL 레이어와 같은 규칙이다.
 */
export function TransitScroller({
  children,
  rail,
  plot,
  label,
}: {
  children: React.ReactNode
  rail: React.ReactNode
  plot?: React.ReactNode
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
     * 지금 가운데 있는 프레임을 도면에 표시한다.
     *
     * 레일은 "얼마나 왔나"를, 도면은 "어디였나"를 말한다. 둘은 다른 질문이라 둘 다 둔다.
     * 다만 같은 프레임을 가리켜야 두 그림이 한 화면의 두 시점이 된다.
     */
    let marked: string | null = null
    const mark = () => {
      const box = element.getBoundingClientRect()
      const centre = box.left + box.width / 2

      let key: string | null = null
      let nearest = Infinity
      for (const frame of element.querySelectorAll<HTMLElement>('[data-photo]')) {
        const r = frame.getBoundingClientRect()
        const distance = Math.abs(r.left + r.width / 2 - centre)
        if (distance < nearest) {
          nearest = distance
          key = frame.dataset['photo'] ?? null
        }
      }
      if (key === marked) return
      marked = key

      for (const point of wrap.querySelectorAll<HTMLElement>('[data-plot-key]')) {
        if (point.dataset['plotKey'] === key) point.dataset['current'] = ''
        else delete point.dataset['current']
      }
    }

    // 스크롤 이벤트는 프레임보다 자주 온다. 68개 rect를 그때마다 재면 굴리는 손이 무거워진다.
    let pending = 0
    const scheduleMark = () => {
      if (pending) return
      pending = requestAnimationFrame(() => {
        pending = 0
        mark()
      })
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
      mark()
    }

    const onScroll = () => {
      report()
      scheduleMark()
    }

    measure()
    // 사진이 늦게 도착하면 스트립 폭이 바뀐다. 그때 눈금도 다시 놓는다.
    const observer = new ResizeObserver(measure)
    observer.observe(element)

    element.addEventListener('scroll', onScroll, { passive: true })
    // preventDefault를 쓰므로 passive일 수 없다.
    element.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      observer.disconnect()
      cancelAnimationFrame(pending)
      element.removeEventListener('scroll', onScroll)
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
      {plot}
    </div>
  )
}
