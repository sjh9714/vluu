/**
 * 콘텐츠 레이어의 타입. 여기는 아무것도 import하지 않는다 —
 * ingest 스크립트(tsx)와 Next 앱이 둘 다 읽기 때문에 의존성이 없어야 한다.
 */

/** `photos-src/` 아래 폴더명. 폴더 = 장비. */
export type CameraKey = 'iphone-15-pro' | 'iphone-12-pro-max' | 'nikon-z50ii'

export interface PhotoExif {
  /** 촬영 당시의 벽시계 시각 + 오프셋. 예: `2025-01-09T00:26:55+09:00` */
  readonly shotAt: string
  /** 구간(=날짜) 그룹핑 키. 현지 날짜다. */
  readonly shotDate: string
  /** EXIF가 말하는 기종. 폴더명이 아니라 실제로 찍은 장비. */
  readonly camera: string | null
  readonly lens: string | null
  /** 35mm 환산 초점거리. 렌즈별 그룹핑에 쓴다. */
  readonly focalLength35: number | null
  readonly aperture: number | null
  /** 노출 시간(초). 표시할 때 1/250 꼴로 되돌린다. */
  readonly shutter: number | null
  readonly iso: number | null
  readonly gps: { readonly lat: number; readonly lon: number } | null
}

export interface PhotoSource {
  /** 미디어 디렉터리 키. 원본 파일명에서 나오며 절대 바뀌지 않는다. */
  readonly key: string
  /** 원본 파일명(확장자 제외). */
  readonly source: string
  /** 원본이 있던 폴더. EXIF가 비었을 때의 장비 폴백. */
  readonly cameraKey: CameraKey
  /** orientation을 적용한 뒤의 크기. */
  readonly width: number
  readonly height: number
  readonly aspect: number
  /** 32px 폭 WebP data URI. DOM 폴백 배경과 GL 저해상도 텍스처에 함께 쓴다. */
  readonly lqip: string
  /** 대표색 `#rrggbb`. 포커스 링과 로딩 플레이스홀더에 쓴다. */
  readonly color: string
  /** AVIF로 구워진 폭. 원본보다 크게 만들지 않으므로 사진마다 다르다. */
  readonly widths: readonly number[]
  /** WebP로도 구워진 폭. AVIF를 못 읽는 브라우저용 폴백이며 widths의 부분집합이다. */
  readonly webpWidths: readonly number[]
  /** Live Photo 영상이 함께 있는지. */
  readonly live: boolean
  readonly exif: PhotoExif
  /** 원본 바이트 해시. 바뀌지 않았으면 ingest가 건너뛴다. */
  readonly hash: string
}

/** 손으로 쓰는 부분. `content/photos.meta.ts`가 채운다. */
export interface PhotoMeta {
  /** URL에 쓰는 이름. 없으면 key를 쓴다. */
  readonly slug?: string
  readonly title: string
  /** 스크린리더가 읽을 서술. 사진에 무엇이 있는지 그대로. */
  readonly alt: string
  /** 사진 옆에 놓는 한 문장. 설명이 아니라 시선. */
  readonly caption: string
  /** 사람이 아는 장소 이름. GPS 좌표의 이름표. */
  readonly place?: string
  /**
   * EXIF에 촬영일이 아예 없을 때만 쓰는 보정값 (`YYYY-MM-DD`).
   * 편집을 거치며 메타데이터가 지워진 프레임이 구간에서 누락되지 않게 한다.
   */
  readonly shotDate?: string
}

/** ingest 산출물 + 손으로 쓴 것을 합친, 앱이 실제로 쓰는 모양. */
export interface Photo extends PhotoSource, PhotoMeta {
  readonly slug: string
}

export interface Leg {
  /** 구간 = 하루. `2025-01-09` */
  readonly date: string
  readonly title: string
  readonly photos: readonly Photo[]
}

export interface Route {
  readonly slug: string
  readonly title: string
  readonly intro: string
  readonly legs: readonly Leg[]
  readonly photos: readonly Photo[]
}
