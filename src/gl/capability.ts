/**
 * WebGL 레이어를 켜도 되는지 판단한다.
 *
 * 이 파일의 요점은 "켤 수 있는가"가 아니라 **"켜지 말아야 할 때가 언제인가"**다.
 * 캔버스는 순전히 덧칠이므로, 조금이라도 미심쩍으면 켜지 않는 쪽이 항상 맞다 —
 * 꺼진 상태의 사이트는 이미 완성되어 있다.
 */

export type GlVerdict = { readonly on: true } | { readonly on: false; readonly because: string }

export function canRunGl(): GlVerdict {
  if (typeof window === 'undefined') return { on: false, because: 'server' }

  // 모션을 끈 사용자에게는 아무것도 얹지 않는다. 약한 버전을 얹는 것도 아니다.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return { on: false, because: 'reduced-motion' }
  }

  // 데이터 절약 모드. 텍스처를 굽는 건 이 사람이 요청한 게 아니다.
  const connection = (navigator as { connection?: { saveData?: boolean } }).connection
  if (connection?.saveData) return { on: false, because: 'save-data' }

  // 코어가 적은 기기에서 68장을 GPU에 올리는 건 프레임을 버는 게 아니라 잃는 것이다.
  if (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 2) {
    return { on: false, because: 'low-core' }
  }

  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
  if (!gl) return { on: false, because: 'no-webgl' }

  const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
  // 우리가 굽는 가장 큰 파생물이 2048이다. 그보다 작으면 뷰어에서 못 쓴다.
  if (maxTexture < 2048) return { on: false, because: 'small-max-texture' }

  gl.getExtension('WEBGL_lose_context')?.loseContext()
  return { on: true }
}

/**
 * 화면 근처에 올려둘 고해상도 텍스처의 상한.
 *
 * 68장을 전부 1280px로 올리면 GPU 메모리 600MB다. 실제로 보이는 건 한 화면 분량이므로
 * 그만큼만 들고 나머지는 LQIP로 둔다. 기기 메모리를 알 수 있으면 참고한다.
 */
export function textureBudget(): number {
  const memory = (navigator as { deviceMemory?: number }).deviceMemory
  if (typeof memory === 'number' && memory <= 4) return 12
  return 24
}
