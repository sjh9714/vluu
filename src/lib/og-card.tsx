import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { ImageResponse } from 'next/og'

/**
 * 링크를 던졌을 때 먼저 보이는 그림.
 *
 * 지금까지 인덱스·노선·Colophon을 공유하면 미리보기 이미지가 아예 없었고, 사진 페이지만
 * 원본 WebP를 그대로 가리켰다. 포트폴리오 링크는 대부분 이 카드로 먼저 읽히므로
 * 사이트가 거기서 시작하게 만든다.
 *
 * 전부 빌드 때 한 번 구워진다. 런타임에 이미지를 만드는 서비스가 붙지 않는다는 규칙은
 * 여기서도 같다.
 */

export const SIZE = { width: 1200, height: 630 }
export const CONTENT_TYPE = 'image/png'

const ASSETS = path.join(process.cwd(), 'assets')

/*
 * Satori는 폰트를 직접 받아야 하고 woff2를 못 읽는다. next/font가 남기는 건 woff2뿐이라
 * 정적 TTF를 레포에 넣었다(OFL, `assets/Archivo-OFL.txt`). 빌드 중에 네트워크를 타지
 * 않는 게 이 프로젝트의 규칙이라 구글 폰트를 받아오지 않는다.
 */
const [medium, bold] = await Promise.all([
  readFile(path.join(ASSETS, 'Archivo-Medium.ttf')),
  readFile(path.join(ASSETS, 'Archivo-Bold.ttf')),
])

const FONTS = [
  { name: 'Archivo', data: medium, weight: 500 as const, style: 'normal' as const },
  { name: 'Archivo', data: bold, weight: 700 as const, style: 'normal' as const },
]

const PAD = 64
const PHOTO_W = 340
const GAP = 56

const INK = '#0a0a0b'
const MUTE = '#55585e'
const FAINT = '#70737a'
const RULE = 'rgba(10, 10, 11, 0.16)'

/**
 * 카드에 얹을 사진.
 *
 * AVIF도 WebP도 아닌 JPEG인 이유는 하나다 — Satori가 확실히 읽는 건 PNG와 JPEG뿐이다.
 * ingest가 프레임마다 `og.jpg`를 하나씩 구워둔다.
 */
export async function photoData(key: string): Promise<string> {
  const file = path.join(process.cwd(), 'public', 'media', key, 'og.jpg')
  return `data:image/jpeg;base64,${(await readFile(file)).toString('base64')}`
}

export interface CardInput {
  /** 제목 위 한 줄. 프레임 번호나 노선 같은, 이 카드가 무엇인지. */
  readonly eyebrow?: string
  readonly title: string
  /** 제목 아래 한 문장. */
  readonly lead?: string
  /** 가운뎃점으로 이어 붙일 사실들. */
  readonly facts?: readonly (string | null | undefined)[]
  readonly photo?: { readonly src: string; readonly aspect: number }
  /**
   * 아래쪽에 한 줄로 놓을 작은 사진들. 있으면 워드마크 대신 여기가 바닥이 된다.
   * 사이트 카드에서 "한 장짜리 대표작"이 아니라 "모음"으로 보이게 하는 자리다.
   */
  readonly strip?: readonly { readonly src: string; readonly aspect: number; readonly label: string }[]
}

/** 바닥 줄의 썸네일 높이. 3:4면 폭 135쯤 된다. */
const THUMB_H = 168

/**
 * 카드에 들어갈 만큼만 남긴다.
 *
 * 노선 소개문은 문단 하나라 그대로 넣으면 카드 밖으로 흘러나간다. 자를 곳은 낱말
 * 경계여야 한다 — 글자 수로 자르면 단어가 반 토막 난 채로 남는다.
 */
function clamp(text: string, limit: number): string {
  if (text.length <= limit) return text
  const cut = text.slice(0, limit)
  const space = cut.lastIndexOf(' ')
  return `${(space > limit * 0.6 ? cut.slice(0, space) : cut).replace(/[.,;:\s]+$/, '')}…`
}

export function renderCard({
  eyebrow,
  title,
  lead,
  facts,
  photo,
  strip,
}: CardInput): ImageResponse {
  const shown = (facts ?? []).filter(Boolean) as string[]
  /*
   * 글 칸의 폭을 손으로 계산해 박는다. Satori의 flex는 브라우저와 달라서
   * `flexGrow: 1` + `minWidth: 0`으로는 줄바꿈이 걸리지 않고 글이 카드 밖으로 흘러나간다.
   */
  const column = SIZE.width - PAD * 2 - (photo ? PHOTO_W + GAP : 0)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#ffffff',
          fontFamily: 'Archivo',
          color: INK,
          padding: PAD,
          gap: GAP,
        }}
      >
        {photo ? (
          /*
           * 사진은 담는다(contain). 잘라내면 3:4 세로가 가로 카드에서 거의 다 날아가고,
           * 무엇보다 이 사이트는 프레임을 자르지 않는 것이 규칙이다.
           */
          <div style={{ display: 'flex', width: PHOTO_W, alignItems: 'center', flexShrink: 0 }}>
            <img
              src={photo.src}
              // 카드 자체의 대체텍스트는 각 라우트의 `alt` export가 낸다. 여기는 그림 안이다.
              alt=""
              width={PHOTO_W}
              height={Math.round(PHOTO_W / photo.aspect)}
              style={{ objectFit: 'contain', border: `1px solid ${RULE}` }}
            />
          </div>
        ) : null}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: column,
            justifyContent: 'center',
          }}
        >
          {eyebrow ? (
            <div style={{ fontSize: 22, letterSpacing: 4, color: FAINT, marginBottom: 20 }}>
              {eyebrow.toUpperCase()}
            </div>
          ) : null}

          <div style={{ fontSize: photo ? 58 : 82, fontWeight: 700, lineHeight: 1.1 }}>
            {clamp(title, 44)}
          </div>

          {lead ? (
            <div style={{ fontSize: 26, color: MUTE, lineHeight: 1.45, marginTop: 22 }}>
              {clamp(lead, photo ? 130 : 180)}
            </div>
          ) : null}

          {shown.length > 0 ? (
            <div style={{ fontSize: 23, color: MUTE, marginTop: 22 }}>{shown.join('  ·  ')}</div>
          ) : null}

          <div style={{ display: 'flex', height: 1, background: RULE, marginTop: 32 }} />

          {strip ? (
            <div style={{ display: 'flex', gap: 24, marginTop: 24 }}>
              {strip.map((item) => (
                <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <img
                    src={item.src}
                    alt=""
                    width={Math.round(THUMB_H * item.aspect)}
                    height={THUMB_H}
                    style={{ objectFit: 'cover', border: `1px solid ${RULE}` }}
                  />
                  <div style={{ fontSize: 19, color: FAINT, letterSpacing: 2 }}>
                    {item.label.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* 제목이 이미 워드마크인 카드에서는 여기를 비운다 — VLUU가 두 번 나온다. */
            <div style={{ display: 'flex', fontSize: 24, letterSpacing: 6, marginTop: 22 }}>VLUU</div>
          )}
        </div>
      </div>
    ),
    { ...SIZE, fonts: FONTS },
  )
}
