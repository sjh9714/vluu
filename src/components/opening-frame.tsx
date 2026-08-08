import type { Photo } from '#content/types'
import * as fmt from '@/lib/format'
import { frameLabel } from '@/lib/grid'
import { Frame } from './frame'
import styles from './opening-frame.module.css'

/**
 * 인덱스를 여는 한 장.
 *
 * 예전엔 제목과 큰 여백으로 열렸다. 1440×900에서 재보면 첫 화면의 절반 이상이 흰
 * 여백이었고 사진은 244px짜리 다섯 장이었다 — 사진을 보러 온 사람에게 그건 아무것도
 * 아니다. 수상작들의 첫 화면이 주장인 이유가 이거다.
 *
 * **자르지 않는다.** 3:4 세로 사진을 가로로 꽉 채우면 대부분이 잘려나간다. 이 사이트는
 * 프레임을 자르지 않는 게 규칙이라, 사진은 높이로 크게 세우고 글이 옆에 선다.
 *
 * **고르지 않는다.** 가장 최근에 찍은 한 장이다 — 규칙이라 사진이 늘면 저절로 바뀌고,
 * 이 자리가 "대표작"이 되지 않는다. 균일 그리드가 아무것도 내세우지 않는다는 것과
 * 같은 이유다. 이름표도 그렇게 읽히도록 `Latest`라고 말한다.
 */
export function OpeningFrame({
  photo,
  number,
  total,
}: {
  photo: Photo
  number: number | undefined
  total: number
}) {
  return (
    <section className={styles.opening} data-opening-frame="">
      {/*
        `Frame`을 그대로 쓴다 — data-photo·data-live·헤어라인이 전부 따라온다.
        그래서 이 한 장도 커서에 반응하고, Live Photo면 여기서 숨쉰다.
      */}
      <Frame
        photo={photo}
        // 높이로 세운 사진이라 폭은 화면 높이에서 나온다. 3:4의 3에 해당하는 값.
        sizes="(min-width: 720px) 58vh, 88vw"
        priority
        showCaption={false}
        className={styles.figure}
      />

      <div className={styles.words}>
        <h1>The whole catalogue</h1>
        <p className={styles.lede}>
          {total} frames from three trips, oldest first.
        </p>

        <p className={styles.latest}>
          <span className={styles.tag}>Latest</span>
          {number !== undefined ? <b>{frameLabel(number)}</b> : null}
          <span>{photo.title}</span>
          <span className={styles.where}>
            {photo.place}
            {photo.exif.shotDate ? ` · ${fmt.date(photo.exif.shotDate)}` : null}
          </span>
        </p>
      </div>
    </section>
  )
}
