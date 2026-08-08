import Link from 'next/link'
import type { Photo, Route } from '#content/types'
import { BANNER_SIZES, bannerFrames, bannerSrc, bannerSrcSet } from '@/lib/banner'
import styles from './opening-banner.module.css'

/**
 * 인덱스를 여는 띠. 사진이 옆으로 계속 흐른다.
 *
 * 목록을 **두 벌** 깔고 첫 벌의 폭만큼(-50%) 밀면 이음매가 안 보인다. 전부
 * `transform` 하나라 **컴포지터에서 돈다** — 이 사이트에서 걷어낸 모션은 전부
 * 메인 스레드가 컴포지터를 쫓다 진 것들이었고, 여기서는 쫓아갈 대상이 없다.
 *
 * **커서를 올리거나 포커스가 들어오면 멈춘다.** 자동으로 움직이는 내용에는 멈출
 * 수단이 있어야 한다 (WCAG 2.2.2). 모션을 끈 사람에게는 아예 안 움직인다.
 *
 * 여기 사진들은 `[data-photo]`가 아니다. GL이 붙으면 매 프레임 자리가 바뀌는 걸
 * 속도로 읽어 흐르는 내내 왜곡이 걸린다 — 고치느라 오래 걸렸던 바로 그 문제다.
 * 배너는 카탈로그가 아니라 배너다.
 */
export function OpeningBanner({ routes }: { routes: readonly Route[] }) {
  const frames = bannerFrames(routes)
  if (frames.length === 0) return null

  return (
    <section className={styles.banner} aria-label="Recent frames" data-banner="">
      <div className={styles.track}>
        <Run frames={frames} />
        {/*
          이어 붙인 사본. 보조기기에는 감춘다 — 같은 사진 아홉 장을 두 번 읽어줄
          이유가 없다. 탭 순서에서도 빠진다.
        */}
        <Run frames={frames} copy />
      </div>
    </section>
  )
}

function Run({ frames, copy = false }: { frames: readonly Photo[]; copy?: boolean }) {
  return (
    <ul className={styles.run} aria-hidden={copy || undefined}>
      {frames.map((photo) => (
        <li key={photo.key} className={styles.item}>
          <Link
            href={`/p/${photo.slug}`}
            className={styles.link}
            tabIndex={copy ? -1 : undefined}
            data-banner-key={photo.key}
          >
            <img
              className={styles.image}
              src={bannerSrc(photo)}
              srcSet={bannerSrcSet(photo)}
              sizes={BANNER_SIZES}
              alt={photo.alt}
              width={900}
              height={600}
              /*
               * 접힌 화면 위라 늦게 받아오면 빈 칸이 흐른다. 보통 화면에서 아홉 장에
               * 약 138KB — 잘라서 굽고 폭을 둘로 나눴기 때문에 이 크기다.
               * 원본을 CSS로 덮었으면 1.5MB였다.
               */
              loading="eager"
              decoding="async"
            />
          </Link>
        </li>
      ))}
    </ul>
  )
}
