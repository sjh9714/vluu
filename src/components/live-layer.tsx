'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { nearest, visible, type Span } from '@/lib/centre'

/**
 * 사진이 숨쉬게 하는 층.
 *
 * 68장 중 50장이 3초짜리 영상을 들고 있는데 지금까지는 뷰어의 재생 버튼 뒤에만 있었다.
 * 이 사이트의 모션은 여기서 나온다 — 스크롤할 때마다 일렁이는 장식이 아니라
 * **피사체 자체**가 움직인다. 그건 다른 데서 베낄 수 없는 종류다.
 *
 * GL 레이어와 같은 규칙으로 산다: DOM이 이미 정해놓은 자리를 읽고 그 위에 얹는다.
 * 서버가 그린 것에는 손대지 않고, 꺼져도 페이지는 그대로다.
 *
 *   커서가 있으면 — 프레임에 잠깐 머물면 그 사진이 살아난다
 *   손가락이면   — 스크롤이 **멎은 뒤** 화면 한가운데 온 하나가 살아난다
 *
 * **한 번에 하나만.** 격자 전체가 움직이면 그건 모션이 아니라 소음이다.
 */

/**
 * 재생되는 영상이 쓸 클래스.
 *
 * CSS Module이 아니라 전역 이름인 이유: 이 엘리먼트는 JS가 만들어 프레임 안으로
 * 옮겨 다니므로 모듈이 붙여주는 해시 이름을 받을 수 없다.
 */
const VIDEO_CLASS = 'vluu-live'

/** 스치고 지나가는 커서와 들여다보는 커서를 가르는 시간. */
const DWELL_MS = 120
/** 스크롤이 멎었다고 볼 시간. 손가락에서만 쓴다. */
const SETTLE_MS = 220

export function LiveLayer() {
  const pathname = usePathname()
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    /*
     * 모션을 끈 사람에게는 아예 돌지 않는다. 약한 버전을 얹는 것도 아니다 —
     * `canRunGl()`이 하는 판단과 같은 결이다.
     */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const connection = (navigator as { connection?: { saveData?: boolean } }).connection
    if (connection?.saveData) return

    const shell = host.current
    if (!shell) return

    /*
     * `<video>`는 딱 하나다. Live인 50장에 하나씩 심으면 DOM만 무거워지고,
     * 어차피 한 번에 하나만 재생한다. 살릴 프레임 안으로 옮겨 넣는다.
     */
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'none'
    video.setAttribute('aria-hidden', 'true')
    video.className = VIDEO_CLASS

    let live: HTMLElement | null = null
    let pending = 0

    const frames = () => [...document.querySelectorAll<HTMLElement>('[data-live]')]

    const stop = () => {
      window.clearTimeout(pending)
      if (!live) return
      video.pause()
      video.removeAttribute('src')
      // load()를 불러야 물고 있던 버퍼를 실제로 놓는다.
      video.load()
      video.remove()
      delete live.dataset['livePlaying']
      live = null
    }

    const start = (frame: HTMLElement) => {
      if (live === frame) return
      stop()

      const key = frame.dataset['live']
      if (!key) return

      /*
       * 표시는 여기 한 곳에만 단다. 한때 GL이 읽기 편하라고 바깥 `[data-photo]`에도
       * 달았는데, 그러면 `querySelector('[data-live-playing]')`가 부모를 먼저 집어
       * 엉뚱한 엘리먼트를 돌려준다. GL은 마운트할 때 이 상자를 기억해 둔다.
       */
      live = frame
      frame.dataset['livePlaying'] = ''
      frame.append(video)
      video.src = `/media/${key}/live.mp4`
      video.currentTime = 0
      /*
       * 거부당하면 조용히 정지 이미지로 남는다. 자동재생 정책은 기기마다 다르고,
       * 여기서 실패하는 건 정상적인 결과다.
       */
      void video.play().catch(() => stop())
    }

    /** 스치고 지나가는 커서가 18MB를 끌어오면 안 된다. 머문 뒤에 시작한다. */
    const dwell = (frame: HTMLElement) => {
      window.clearTimeout(pending)
      pending = window.setTimeout(() => start(frame), DWELL_MS)
    }

    video.addEventListener('ended', stop)

    // ── 커서가 있는 기기 ────────────────────────────────────
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')

    const onOver = (event: PointerEvent) => {
      if (!fine.matches || event.pointerType === 'touch') return
      const target = event.target
      if (!(target instanceof Element)) return
      const frame = target.closest<HTMLElement>('[data-live]')
      if (frame) dwell(frame)
      else stop()
    }

    // ── 손가락 기기 ────────────────────────────────────────
    /*
     * 굴리는 **동안에는** 아무것도 재생하지 않는다. 스크롤 중에 움직이는 것을 얹는 게
     * 이 사이트에서 계속 문제였다. 멎은 뒤에 가운데 하나만 살린다.
     */
    const onScroll = () => {
      if (fine.matches) return
      stop()
      window.clearTimeout(pending)
      pending = window.setTimeout(() => {
        const spans: Span[] = frames().map((frame) => {
          const rect = frame.getBoundingClientRect()
          return { key: frame.dataset['live']!, start: rect.top, end: rect.bottom }
        })
        const shown = visible(spans, 0, window.innerHeight)
        const key = nearest(shown, window.innerHeight / 2)
        const frame = frames().find((f) => f.dataset['live'] === key)
        if (frame) start(frame)
      }, SETTLE_MS)
    }

    document.addEventListener('pointerover', onOver, { passive: true })
    document.addEventListener('pointerleave', stop)
    window.addEventListener('scroll', onScroll, { passive: true })
    // 커서가 없는 기기에서는 처음 한 번 가운데를 살려준다.
    if (!fine.matches) onScroll()

    return () => {
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerleave', stop)
      window.removeEventListener('scroll', onScroll)
      video.removeEventListener('ended', stop)
      stop()
    }
  }, [pathname])

  // 이 엘리먼트는 아무것도 그리지 않는다. 층이 붙을 자리를 잡아둘 뿐이다.
  return <div ref={host} hidden />
}
