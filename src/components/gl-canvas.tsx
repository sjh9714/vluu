'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { canRunGl } from '@/gl/capability'
import type { GlStage } from '@/gl/stage'

import styles from './gl-canvas.module.css'

/**
 * 앱 루트에 상주하는 단 하나의 캔버스.
 *
 * GlStage는 라우트보다 오래 산다 — 컨텍스트와 GPU에 올라간 텍스처가 이어져야
 * Phase 4의 화면 간 모프(같은 텍스처를 그대로 들고 넘어가기)가 가능하다.
 * 라우트가 바뀔 때 바뀌는 건 어떤 DOM 엘리먼트를 따라다니느냐뿐이다.
 *
 * GL 코드는 **필요하다고 확인된 뒤에** 동적으로 불러온다. Colophon처럼 사진이
 * 없는 화면에서도 ogl을 파싱하고 WebGL 컨텍스트를 만들어보면, 아무것도 그리지
 * 않으면서 메인 스레드만 수백 ms 잡아먹는다.
 *
 * 켜지지 않는 경우가 여럿이고 전부 정상이다. 그때는 이 컴포넌트가 아무것도
 * 하지 않고, 아래 DOM 사이트가 그대로 보인다.
 */
export function GlCanvas() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const stage = useRef<GlStage | null>(null)
  const pathname = usePathname()

  // 1. 필요해진 순간 딱 한 번 만든다. 첫 화면에 사진이 없으면 다음 화면에서 만든다.
  useEffect(() => {
    const element = canvas.current
    if (!element || stage.current) return
    if (!document.querySelector('[data-photo]')) return

    const verdict = canRunGl()
    if (!verdict.on) {
      // 왜 안 켰는지는 남겨둔다. 디버깅과 e2e가 이걸 읽는다.
      document.documentElement.dataset['glOff'] = verdict.because
      return
    }

    let cancelled = false
    void (async () => {
      try {
        // 첫 페인트가 끝난 뒤에 시작한다. GL은 덧칠이므로 사진이 화면에 뜨는 일보다
        // 늦어도 되고, 크리티컬 패스에 끼어들면 그 사진들이 늦게 뜬다.
        await new Promise<void>((resolve) => {
          const idle = window.requestIdleCallback
          if (idle) idle(() => resolve(), { timeout: 1200 })
          else setTimeout(resolve, 200)
        })
        if (cancelled) return

        const [{ GlStage }, { publishHandle }] = await Promise.all([
          import('@/gl/stage'),
          import('@/gl/handle'),
        ])
        if (cancelled) return

        const created = new GlStage(element)
        created.mount()
        created.start()
        stage.current = created
        publishHandle(created)
      } catch (error) {
        // 컨텍스트 생성이 늦게 실패하는 기기가 있다. 실패는 조용히 폴백으로 끝난다.
        document.documentElement.dataset['glOff'] = 'threw'
        console.warn('[gl] 레이어를 켜지 못했다 — DOM 폴백으로 계속한다', error)
      }
    })()

    // 여기서 stage를 버리지 않는다. 라우트가 바뀌었다고 컨텍스트를 새로 만들면
    // 텍스처가 매번 날아가고, 모프가 딛고 설 연속성도 사라진다.
    return () => {
      cancelled = true
    }
  }, [pathname])

  // 2. 화면이 바뀌면 따라다닐 엘리먼트만 새로 잡는다.
  useEffect(() => {
    const current = stage.current
    if (!current) return
    current.remount()
    // 그릴 게 없는 화면에서는 루프를 멈춘다. 돌아오면 다시 돈다.
    if (current.trackedCount > 0) current.start()
    else current.stop()
  }, [pathname])

  // 3. 정리는 컴포넌트가 사라질 때만.
  useEffect(() => {
    const element = canvas.current
    const onLost = (event: Event) => {
      event.preventDefault()
      stage.current?.stop()
      document.documentElement.dataset['glOff'] = 'context-lost'
    }
    element?.addEventListener('webglcontextlost', onLost)

    return () => {
      element?.removeEventListener('webglcontextlost', onLost)
      void import('@/gl/handle').then(({ revokeHandle }) => revokeHandle())
      stage.current?.dispose()
      stage.current = null
    }
  }, [])

  return <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
}
