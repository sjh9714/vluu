import { Texture } from 'ogl'
import type { OGLRenderingContext } from 'ogl'

/**
 * GPU에 올라간 텍스처를 관리한다.
 *
 * 이 풀은 **아무것도 내려받지 않는다.** 화면의 `<img>`가 이미 srcset에서 맞는 폭을
 * 골라 받아뒀으므로 그 엘리먼트를 그대로 올린다. 따로 받으면 같은 사진을 두 번 받고,
 * 어느 폭을 고를지도 브라우저보다 잘 알 수 없다.
 *
 * 아무것도 미리 하지 않는 것도 규칙이다. 인덱스에는 68장이 있고, 진입하자마자
 * 68개의 LQIP를 디코딩하면 그것만으로 메인 스레드가 수백 ms 멎는다.
 * 화면에 들어온 것만, 들어온 순간에 준비한다.
 */

interface Slot {
  readonly texture: Texture
  /** 되돌릴 때 쓸 32px LQIP의 주소. 문자열만 들고 있고 디코딩은 필요할 때 한다. */
  readonly lqip: string
  /** 이 텍스처에 그릴 게 들어있는지. false면 메시를 그리지 않는다. */
  ready: boolean
  /** GPU에 올라간 게 실제 이미지인지(true), LQIP인지(false). */
  full: boolean
  placeholder?: HTMLImageElement
  /** 마지막으로 필요했던 시각. 내릴 것을 고를 때 쓴다. */
  touchedAt: number
}

export class TexturePool {
  private readonly slots = new Map<string, Slot>()
  private readonly gl: OGLRenderingContext
  private readonly budget: number
  private clock = 0

  constructor(gl: OGLRenderingContext, budget: number) {
    this.gl = gl
    this.budget = budget
  }

  /** 빈 텍스처를 하나 잡아둔다. 내용은 화면에 들어올 때 채운다. */
  acquire(key: string, lqip: string): Texture {
    const existing = this.slots.get(key)
    if (existing) return existing.texture

    const texture = new Texture(this.gl, {
      generateMipmaps: false,
      minFilter: this.gl.LINEAR,
      magFilter: this.gl.LINEAR,
    })
    this.slots.set(key, { texture, lqip, ready: false, full: false, touchedAt: this.clock++ })
    return texture
  }

  /** 그릴 내용이 들어있는지. 아니면 DOM 이미지가 계속 자리를 지켜야 한다. */
  isReady(key: string): boolean {
    return this.slots.get(key)?.ready ?? false
  }

  /**
   * 화면에 들어온 프레임을 준비한다.
   *
   * `<img>`가 이미 받아졌으면 그걸 바로 올린다 — 대개 이 경우다.
   * 아직이면(lazy 이미지가 막 들어온 참이면) LQIP로 자리를 채우고 기다린다.
   */
  activate(key: string): void {
    const slot = this.slots.get(key)
    if (slot) slot.touchedAt = this.clock++
  }

  /** 화면의 `<img>`를 GPU에 올린다. 이미 올라가 있으면 아무것도 하지 않는다. */
  promote(key: string, image: HTMLImageElement): void {
    const slot = this.slots.get(key)
    if (!slot || slot.full) return

    if (image.complete && image.naturalWidth > 0) {
      slot.texture.image = image
      slot.texture.needsUpdate = true
      slot.ready = true
      slot.full = true
      return
    }

    // 아직 안 받아졌으면 도착할 때 올리고, 그동안은 LQIP로 자리를 채운다.
    image.addEventListener(
      'load',
      () => {
        const current = this.slots.get(key)
        if (!current || image.naturalWidth === 0) return
        current.texture.image = image
        current.texture.needsUpdate = true
        current.ready = true
        current.full = true
      },
      { once: true },
    )
    this.ensurePlaceholder(key, slot, false)
  }

  /**
   * 예산을 넘긴 만큼 오래된 것부터 LQIP로 되돌린다.
   *
   * LQIP는 이 순간에야 디코딩한다. 미리 만들어두면 진입할 때 68개를 한꺼번에 디코딩하게 되고,
   * 그렇다고 안 만들면 되돌릴 대상이 없어 eviction 자체가 조용히 죽는다.
   */
  evict(): void {
    const promoted = [...this.slots.entries()].filter(([, slot]) => slot.full)
    if (promoted.length <= this.budget) return

    promoted
      .sort((a, b) => a[1].touchedAt - b[1].touchedAt)
      .slice(0, promoted.length - this.budget)
      .forEach(([key, slot]) => this.ensurePlaceholder(key, slot, true))
  }

  /**
   * LQIP를 준비하고, `demote`면 준비되는 대로 그걸로 갈아 끼운다.
   * 이미 준비돼 있으면 즉시 처리한다.
   */
  private ensurePlaceholder(key: string, slot: Slot, demote: boolean): void {
    const apply = () => {
      const current = this.slots.get(key)
      const placeholder = current?.placeholder
      if (!current || !placeholder) return
      // 그 사이 다시 화면에 들어와 실제 이미지가 올라갔으면 건드리지 않는다.
      if (current.full && !demote) return
      current.texture.image = placeholder
      current.texture.needsUpdate = true
      current.ready = true
      current.full = false
    }

    if (slot.placeholder) {
      if (slot.placeholder.complete) apply()
      return
    }

    const placeholder = new Image()
    slot.placeholder = placeholder
    placeholder.src = slot.lqip
    if (placeholder.complete) apply()
    else placeholder.addEventListener('load', apply, { once: true })
  }

  /** 실제 이미지가 올라간 개수. 예산이 지켜지는지 보는 값이다. */
  get promoted(): number {
    let count = 0
    for (const slot of this.slots.values()) if (slot.full) count += 1
    return count
  }

  get size(): number {
    return this.slots.size
  }

  dispose(): void {
    this.slots.clear()
  }
}
