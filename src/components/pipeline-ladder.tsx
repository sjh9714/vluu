'use client'

import { useState } from 'react'
import type { Photo } from '#content/types'
import './range-input.css'
import styles from './pipeline-ladder.module.css'

export interface Rung {
  readonly width: number
  readonly avif: number
  readonly webp: number | null
}

/**
 * 한 장의 사진이 실제로 어떤 사다리로 구워졌는지.
 *
 * 크기는 빌드할 때 그 파일들을 직접 재서 넘어온다 — 손으로 적으면 다음 ingest에서
 * 곧바로 거짓말이 된다. 슬라이더를 옮기면 그 폭의 파일을 진짜로 받아 보여준다.
 */
export function PipelineLadder({ photo, rungs }: { photo: Photo; rungs: readonly Rung[] }) {
  const [step, setStep] = useState(rungs.length - 1)
  const rung = rungs[step] ?? rungs[rungs.length - 1]
  if (!rung) return null

  const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`
  const widest = rungs[rungs.length - 1]

  return (
    <div className={styles.ladder}>
      <div className={styles.stage} style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
        {/*
          next/image를 쓰지 않는 이유가 여기서 눈에 보인다 — 어떤 파일이 나갈지
          정확히 지정할 수 있어야 이 비교가 성립한다. srcSet 없이 이 폭 하나만 받는다.
        */}
        <img
          key={rung.width}
          className={styles.frame}
          src={`/media/${photo.key}/${rung.width}.avif`}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
        />
      </div>

      <div className={styles.controls}>
        <label className={styles.knob}>
          <span>
            Width <b>{rung.width}px</b>
          </span>
          <input
            className="vluu-range"
            type="range"
            min={0}
            max={rungs.length - 1}
            step={1}
            value={step}
            onChange={(event) => setStep(Number(event.target.value))}
            aria-label="Derivative width"
          />
        </label>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Width</th>
              <th>AVIF</th>
              <th>WebP</th>
              <th>Ratio</th>
            </tr>
          </thead>
          <tbody>
            {rungs.map((row) => (
              <tr key={row.width} data-current={row.width === rung.width || undefined}>
                <td>{row.width}</td>
                <td>{kb(row.avif)}</td>
                <td>{row.webp === null ? '—' : kb(row.webp)}</td>
                <td>{row.webp === null ? '—' : `${(row.webp / row.avif).toFixed(2)}×`}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className={styles.note}>
          WebP runs close to twice the size at matching quality, which is why it is only baked at the
          two widths a browser without AVIF would actually use. The ladder stops at{' '}
          {widest ? `${widest.width}px` : 'the top rung'}: a 3:4 portrait filling a 16-inch display
          needs 1675 pixels, and the step above costs half again as many bytes for detail the viewer
          never shows.
        </p>
      </div>
    </div>
  )
}
