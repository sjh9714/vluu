'use client'

import { useRef, useState } from 'react'
import type { Photo } from '#content/types'
import styles from './viewer-stage.module.css'

/**
 * Live Photo. 정지 이미지 위에 2초짜리 영상을 겹치고, 요청이 있을 때만 재생한다.
 *
 * 규칙:
 * - `preload="none"` — 68장 중 50장이 Live다. 미리 받으면 뷰어 진입이 무거워진다.
 * - 소리 없음 — 인코딩 단계에서 오디오를 버렸다. 자동재생 차단도 피하고 조용하기도 하다.
 * - 끝나면 정지 이미지로 돌아간다. 루프는 시선을 붙잡아 두려는 장치라 쓰지 않는다.
 *
 * `prefers-reduced-motion` 판단은 JS가 아니라 CSS가 한다. matchMedia로 정하면
 * 서버에서는 아무것도 못 그리고 하이드레이션 후에야 컨트롤이 튀어나온다 —
 * 미디어 쿼리로 숨기면 첫 페인트부터 올바르고, 숨겨진 버튼은 탭 순서에서도 빠진다.
 */
export function LiveFrame({ photo }: { photo: Photo }) {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  if (!photo.live) return null

  const start = () => {
    const element = video.current
    if (!element) return
    element.currentTime = 0
    // 브라우저가 재생을 거부하면 조용히 정지 이미지로 남는다.
    void element.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    )
  }

  const stop = () => {
    video.current?.pause()
    setPlaying(false)
  }

  return (
    <>
      <video
        ref={video}
        className={styles.live}
        data-playing={playing || undefined}
        src={`/media/${photo.key}/live.mp4`}
        preload="none"
        muted
        playsInline
        onEnded={stop}
        aria-hidden="true"
      />
      <button
        type="button"
        className={styles.liveToggle}
        onPointerEnter={start}
        onPointerLeave={stop}
        onFocus={start}
        onBlur={stop}
        onClick={playing ? stop : start}
        aria-pressed={playing}
      >
        {playing ? 'Playing' : 'Live'}
      </button>
    </>
  )
}
