'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, type CSSProperties, type PointerEvent } from 'react'
import type { Photo } from '#content/types'
import * as fmt from '@/lib/format'
import { follow, readGesture } from '@/lib/gesture'
import { frameLabel } from '@/lib/grid'
import { LiveFrame } from './live-frame'
import { PhotoPicture } from './photo-picture'
import styles from './photo-modal.module.css'

/**
 * 인덱스 위에 겹쳐 여는 사진 상세.
 *
 * `<dialog>.showModal()`을 쓰지 않는다. 그건 최상위 레이어에 올라가 **모든 z-index 위**에
 * 놓이는데, 이 사이트의 사진은 그 아래 캔버스가 그리므로 사진만 가려진다.
 * 대신 직접 만들되 플랫폼이 주는 것은 그대로 쓴다 — 배경에 `inert`를 걸면
 * 포커스가 밖으로 새지 않아 별도의 포커스 트랩이 필요 없다.
 */
export function PhotoModal({
  photo,
  number,
  total,
  previous,
  next,
}: {
  photo: Photo
  number: number | undefined
  total: number
  previous: Photo | undefined
  next: Photo | undefined
}) {
  const router = useRouter()
  const shell = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLElement>(null)
  const veil = useRef<HTMLDivElement>(null)

  /**
   * 닫기 전에 지금 사진이 있는 자리를 GL에 넘긴다.
   *
   * 열 때는 GL이 그리드 클릭을 직접 듣고 알아서 기억하지만, 닫는 계기는 DOM 밖에 있다 —
   * Esc, 베일 클릭, 닫기 버튼. 넘겨주지 않으면 사진이 그리드로 돌아가지 않고 그냥 사라진다.
   */
  const close = useCallback(() => {
    const rect = box.current?.getBoundingClientRect()
    if (rect) window.__vluuGl?.beginMorph(photo.key, rect)
    router.back()
  }, [router, photo.key])

  useEffect(() => {
    const background = document.getElementById('page-root')
    const restoreTo = document.activeElement as HTMLElement | null
    const scrollY = window.scrollY

    background?.setAttribute('inert', '')
    // 스크롤을 잠근다. position:fixed로 잠그면 뒤 그리드의 좌표가 통째로 밀려
    // 닫을 때 되돌아갈 자리를 잃는다.
    document.documentElement.style.overflow = 'hidden'
    shell.current?.focus()

    return () => {
      background?.removeAttribute('inert')
      document.documentElement.style.overflow = ''
      window.scrollTo(0, scrollY)
      // 눌렀던 프레임으로 돌려준다. 인덱스가 언마운트되지 않으므로 그 자리에 그대로 있다.
      // preventScroll이 없으면 포커스가 그 자리로 스크롤을 끌어당겨 방금 복원한 위치를 뭉갠다.
      restoreTo?.focus?.({ preventScroll: true })
    }
  }, [])

  /*
   * 키 핸들러가 매번 봐야 하는 최신 값. 리스너 자체는 한 번만 붙인다.
   *
   * 이걸 의존성으로 걸면 사진을 넘길 때마다 리스너를 떼었다 붙이게 되고,
   * 그 사이에 들어온 키 입력이 통째로 사라진다 — 빠르게 여러 번 누르면 실제로 씹힌다.
   */
  const latest = useRef({ previous, next, close })
  useEffect(() => {
    latest.current = { previous, next, close }
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const { previous: back, next: forward, close: dismiss } = latest.current
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
        return
      }
      /*
       * 앞뒤는 replace로 간다. push로 쌓으면 Esc 한 번에 닫히지 않고
       * 넘겨본 사진 수만큼 뒤로가기를 눌러야 한다.
       */
      if (event.key === 'ArrowLeft' && back) router.replace(`/p/${back.slug}`)
      if (event.key === 'ArrowRight' && forward) router.replace(`/p/${forward.slug}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])

  /*
   * 손가락으로 사진을 넘기고 닫는다.
   *
   * 지금까지 폰에서 사진을 넘기려면 32px짜리 `‹ ›`를 정확히 눌러야 했다. 그건 폰에서
   * 사진을 넘기는 방법이 아니다 — 미는 게 그 방법이다.
   *
   * 마우스는 받지 않는다. 마우스 드래그는 클릭·선택과 싸우고, 데스크톱에는 이미
   * 화살표 키와 버튼이 있다. 판정과 따라오는 양은 `@/lib/gesture`의 순수 함수가 정한다.
   */
  const drag = useRef<{ id: number; x: number; y: number; t: number; still: boolean } | null>(null)

  const frame = () => ({ width: window.innerWidth, height: window.innerHeight })

  const rest = (animate: boolean) => {
    const plate = box.current
    if (plate) {
      plate.style.transition = animate ? `transform var(--t-base) var(--ease)` : 'none'
      plate.style.transform = ''
    }
    if (veil.current) veil.current.style.opacity = ''
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return
    drag.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp,
      // 모션을 끈 사람에게는 따라오는 연출만 뺀다. 넘기는 기능 자체는 연출이 아니다.
      still: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }
    /*
     * 캡처는 손가락이 사진 밖으로 나가도 이벤트가 계속 오게 한다. 없으면 크게 끌 때
     * 중간에 끊긴다 — 있으면 좋은 것이지 없으면 안 되는 것은 아니다. 브라우저가 모르는
     * 포인터(합성 이벤트, 이미 끝난 손가락)면 던지므로 여기서 막는다.
     */
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* 캡처 없이도 판정은 그대로 돈다 */
    }
    if (box.current) box.current.style.transition = 'none'
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const held = drag.current
    if (!held || held.id !== event.pointerId || held.still) return
    const shift = follow(
      { dx: event.clientX - held.x, dy: event.clientY - held.y, ms: event.timeStamp - held.t },
      frame(),
    )
    if (box.current) box.current.style.transform = `translate(${shift.x}px, ${shift.y}px)`
    if (veil.current) veil.current.style.opacity = String(shift.veil)
  }

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const held = drag.current
    drag.current = null
    if (!held || held.id !== event.pointerId) return

    const gesture = readGesture(
      { dx: event.clientX - held.x, dy: event.clientY - held.y, ms: event.timeStamp - held.t },
      frame(),
    )

    /*
     * 닫기는 원위치시키지 않고 그대로 넘긴다. close()가 지금 rect를 재서 GL에 주는데,
     * getBoundingClientRect()는 transform을 반영하므로 **끌던 자리에서** 그리드로 이어진다.
     */
    if (gesture === 'close') {
      close()
      return
    }

    rest(true)
    if (gesture === 'prev' && previous) router.replace(`/p/${previous.slug}`)
    if (gesture === 'next' && next) router.replace(`/p/${next.slug}`)
  }

  const onPointerCancel = () => {
    drag.current = null
    rest(true)
  }

  const facts: Array<[string, string | null]> = [
    ['Frame', number ? `${frameLabel(number)} / ${frameLabel(total)}` : null],
    ['Place', photo.place ?? null],
    ['Date', photo.exif.shotDate ? fmt.date(photo.exif.shotDate) : null],
    ['Time', fmt.time(photo.exif.shotAt)],
    ['Camera', photo.exif.camera],
    ['Exposure', fmt.exposureLine(photo.exif)],
    ['Coords', fmt.coords(photo.exif.gps)],
    ['Pixels', `${photo.width} × ${photo.height}`],
  ]

  return (
    <>
      {/* 바깥 클릭으로 닫힌다. 베일 자체가 그 판정 영역이다. */}
      <div ref={veil} className={styles.veil} onClick={close} aria-hidden="true" />

      <div
        ref={shell}
        className={styles.shell}
        role="dialog"
        aria-modal="true"
        aria-label={photo.title}
        tabIndex={-1}
        data-overlay=""
        style={{ '--frame-lqip': `url("${photo.lqip}")` } as CSSProperties}
      >
        <div className={styles.plate}>
          <figure
            ref={box}
            className={styles.box}
            data-photo={photo.key}
            style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <PhotoPicture
              photo={photo}
              sizes="(max-width: 720px) 92vw, 40vw"
              className={styles.image}
              eager
            />
            <LiveFrame photo={photo} />
          </figure>

          {/*
            노선의 끝에서는 버튼을 아예 그리지 않는다. 비활성 상태로 두고 투명하게 만들면
            눈에는 안 보여도 접근성 트리와 탭 순서에는 그대로 남아, 스크린리더에게
            누를 수 없는 것을 계속 읽어준다.
          */}
          {previous ? (
            <button
              type="button"
              className={`${styles.step} ${styles.prev}`}
              onClick={() => router.replace(`/p/${previous.slug}`)}
              aria-label={`Previous — ${previous.title}`}
            >
              ‹
            </button>
          ) : null}
          {next ? (
            <button
              type="button"
              className={`${styles.step} ${styles.next}`}
              onClick={() => router.replace(`/p/${next.slug}`)}
              aria-label={`Next — ${next.title}`}
            >
              ›
            </button>
          ) : null}
        </div>

        <div>
          <p className={styles.caption}>
            {number ? <span className={styles.number}>{frameLabel(number)}</span> : null}
            <span className={styles.title}>{photo.title}</span>
            <span>{photo.caption}</span>
            <span className={styles.spacer} />
            <span>{photo.place}</span>
          </p>

          {/* 촬영정보는 접어둔다. 모달은 훑어보는 자리이고, 전부 필요하면 전체 페이지가 있다. */}
          <details>
            <summary className={styles.more}>Shot details</summary>
            <dl className={styles.facts}>
              {facts
                .filter((entry): entry is [string, string] => entry[1] !== null)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
          </details>
        </div>

        <button
          type="button"
          className={styles.close}
          onClick={close}
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </>
  )
}
