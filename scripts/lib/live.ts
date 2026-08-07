import { execFile } from 'node:child_process'
import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** 재생 폭. 세로 사진이면 720×960이 된다. */
const PLAYBACK_WIDTH = 720

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  )
}

/** 정지 프레임 옆에 같은 이름의 .MOV가 있으면 Live Photo다. */
export async function findLiveSource(stillFile: string): Promise<string | null> {
  const mov = path.join(
    path.dirname(stillFile),
    `${path.basename(stillFile, path.extname(stillFile))}.MOV`,
  )
  return (await exists(mov)) ? mov : null
}

/**
 * Live Photo의 MOV를 웹에서 바로 재생 가능한 mp4로 굽는다.
 *
 * H.264 하나만 만든다. VP9/AV1이 더 작지만, 이 영상들은 hover에 반응해
 * 곧바로 시작해야 하는 2초짜리다 — 하드웨어 디코딩이 가장 널리 깔린 코덱이
 * 시작 지연과 배터리에서 이긴다.
 *
 * 소리는 버린다. 어차피 음소거가 아니면 브라우저가 자동재생을 막고,
 * 조용한 감상 경험에 소리가 끼어들 이유도 없다.
 *
 * 회전은 ffmpeg이 display matrix를 보고 알아서 적용한다 (아이폰 MOV는
 * 가로로 저장되고 -90 회전 정보만 들고 있다).
 */
export async function deriveLive(movFile: string, outDir: string): Promise<void> {
  await mkdir(outDir, { recursive: true })
  await run('ffmpeg', [
    '-y',
    '-loglevel', 'error',
    '-i', movFile,
    '-an',
    '-vf', `scale=${PLAYBACK_WIDTH}:-2`,
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-pix_fmt', 'yuv420p',
    '-crf', '28',
    '-preset', 'slow',
    '-movflags', '+faststart',
    path.join(outDir, 'live.mp4'),
  ])
}
