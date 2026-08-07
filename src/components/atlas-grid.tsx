import type { CSSProperties } from 'react'
import type { Photo } from '#content/types'
import { atlasCell, atlasSizes } from '@/lib/atlas'
import { Frame } from './frame'
import styles from './atlas-grid.module.css'

/**
 * Phase 2의 ATLAS는 정적 그리드다.
 * Phase 3에서 이 위에 WebGL 무한 평면이 얹히고, 캔버스를 끄면 정확히 이 화면으로 돌아온다.
 */
export function AtlasGrid({ photos }: { photos: readonly Photo[] }) {
  return (
    <div className={styles.grid}>
      {photos.map((photo, index) => {
        const { span, drift } = atlasCell(index)
        return (
          <Frame
            key={photo.key}
            photo={photo}
            sizes={atlasSizes(span)}
            // 첫 줄만 미리 받는다. 나머지는 lazy — 68장을 한꺼번에 물면 LCP가 무너진다.
            priority={index < 4}
            className={styles.cell}
            style={{ '--span': span, '--drift': drift } as CSSProperties}
          />
        )
      })}
    </div>
  )
}
