'use client'

import { useEffect, useRef, useState } from 'react'
import type { Photo } from '#content/types'
import { canRunGl } from '@/gl/capability'
import './range-input.css'
import styles from './shader-playground.module.css'

/**
 * 사이트가 쓰는 셰이더를 직접 만져보는 자리.
 *
 * **소스는 `src/gl/shaders.ts` 그대로다.** 설명용으로 베껴 쓰면 본체가 바뀔 때
 * 이 페이지만 조용히 옛말을 하게 된다. 여기서 보이는 왜곡은 노선을 굴릴 때
 * 실제로 일어나는 그 왜곡이다.
 *
 * 캔버스는 화면에 들어올 때까지 만들지 않는다. Colophon은 읽는 페이지이고,
 * 스크롤해서 여기까지 오지 않은 사람이 WebGL 컨텍스트 값을 낼 이유가 없다.
 */
export function ShaderPlayground({ photo }: { photo: Photo }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const mount = useRef<HTMLDivElement>(null)
  const knobs = useRef({ velocity: 0, intensity: 1 })

  const [velocity, setVelocity] = useState(0)
  const [intensity, setIntensity] = useState(1)
  const [live, setLive] = useState(false)

  // rAF 루프가 매 프레임 읽는 최신 값. 루프를 슬라이더에 의존시키면 값이 바뀔 때마다
  // 렌더러를 다시 세우게 된다.
  useEffect(() => {
    knobs.current = { velocity, intensity }
  })

  useEffect(() => {
    const host = mount.current
    const element = canvas.current
    if (!host || !element) return
    if (!canRunGl().on) return

    let stop = () => {}
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()

        void (async () => {
          const [{ Camera, Mesh, Plane, Program, Renderer, Texture, Transform }, shaders] =
            await Promise.all([import('ogl'), import('@/gl/shaders')])

          const renderer = new Renderer({
            canvas: element,
            alpha: true,
            antialias: false,
            dpr: Math.min(window.devicePixelRatio, 2),
          })
          const camera = new Camera(renderer.gl)
          const scene = new Transform()
          const texture = new Texture(renderer.gl, {
            generateMipmaps: false,
            minFilter: renderer.gl.LINEAR,
            magFilter: renderer.gl.LINEAR,
          })

          const image = new Image()
          image.src = `/media/${photo.key}/640.webp`
          image.decoding = 'async'
          void image.decode().then(() => {
            texture.image = image
            texture.needsUpdate = true
          })

          const program = new Program(renderer.gl, {
            vertex: shaders.VERTEX,
            fragment: shaders.FRAGMENT,
            transparent: true,
            depthTest: false,
            uniforms: {
              tMap: { value: texture },
              uVelocity: { value: [0, 0] },
              uIntensity: { value: 1 },
              uOpacity: { value: 1 },
              // 커서 근처 선명해지는 효과는 여기선 쓰지 않는다. 슬라이더가 둘이면 충분하다.
              uFocus: { value: 1 },
            },
          })
          const mesh = new Mesh(renderer.gl, { geometry: new Plane(renderer.gl), program })
          mesh.setParent(scene)

          let raf = 0
          const size = () => {
            const box = host.getBoundingClientRect()
            renderer.setSize(box.width, box.height)
            camera.orthographic({
              left: -box.width / 2,
              right: box.width / 2,
              bottom: -box.height / 2,
              top: box.height / 2,
              near: -100,
              far: 100,
            })
            mesh.scale.set(box.width, box.height, 1)
          }

          const frame = () => {
            raf = requestAnimationFrame(frame)
            program.uniforms['uVelocity'].value = [knobs.current.velocity, 0]
            program.uniforms['uIntensity'].value = knobs.current.intensity
            renderer.render({ scene, camera })
          }

          size()
          window.addEventListener('resize', size, { passive: true })
          raf = requestAnimationFrame(frame)
          setLive(true)

          stop = () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('resize', size)
          }
        })()
      },
      { rootMargin: '200px' },
    )

    observer.observe(host)
    return () => {
      observer.disconnect()
      stop()
    }
  }, [photo.key])

  return (
    <div className={styles.playground}>
      <div ref={mount} className={styles.stage} style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
        {/* GL이 못 뜨면 이 사진이 그대로 남는다. 이 페이지에서도 폴백은 열화판이 아니다. */}
        <img
          className={styles.still}
          src={`/media/${photo.key}/640.webp`}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
          data-hidden={live || undefined}
        />
        {/* 전역 GL 캔버스와 구분되는 이름표. 화면에 캔버스가 둘이라 위치로는 못 고른다. */}
        <canvas ref={canvas} className={styles.canvas} data-playground="" aria-hidden="true" />
      </div>

      <div className={styles.knobs}>
        <label className={styles.knob}>
          <span>
            Scroll velocity <b>{velocity.toFixed(3)}</b>
          </span>
          <input
            className="vluu-range"
            type="range"
            min={-0.3}
            max={0.3}
            step={0.005}
            value={velocity}
            onChange={(event) => setVelocity(Number(event.target.value))}
          />
          <span className={styles.note}>
            Real scrolling peaks near 0.04. Past that the smear is capped on purpose.
          </span>
        </label>

        <label className={styles.knob}>
          <span>
            Intensity <b>{intensity.toFixed(2)}</b>
          </span>
          <input
            className="vluu-range"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intensity}
            onChange={(event) => setIntensity(Number(event.target.value))}
          />
          <span className={styles.note}>
            Every effect collapses to nothing at zero — that is what lets the canvas be switched off
            without the page changing.
          </span>
        </label>

        <button
          type="button"
          className={styles.reset}
          onClick={() => {
            setVelocity(0)
            setIntensity(1)
          }}
        >
          Reset
        </button>
      </div>
    </div>
  )
}
