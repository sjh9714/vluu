import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl'
import { textureBudget } from './capability'
import { FRAGMENT, VERTEX } from './shaders'
import { TexturePool } from './texture-pool'
import { advance, clampSpeed, frameDelta, perFrame } from './velocity'

/**
 * DOM 위에 얹는 WebGL 레이어.
 *
 * 이 클래스는 레이아웃도 하지 않고 이미지도 받지 않는다. DOM이 이미 정한 자리를
 * 읽어 같은 좌표에 평면을 놓고, 브라우저가 이미 받아둔 `<img>`를 텍스처로 쓸 뿐이다.
 * 그래서 캔버스를 끄면 그 아래 화면이 이미 정답이고, 켜고 끄는 사이에 아무것도
 * 움직이지 않으며, 클라이언트로 넘어가는 사진 데이터가 0바이트다.
 *
 * 좌표계는 **캔버스 자신의 CSS 박스**다 — 직교 카메라를 그 박스에 맞춰두면
 * getBoundingClientRect()의 값을 변환 없이 넣을 수 있다.
 */

interface Tracked {
  readonly key: string
  readonly element: HTMLElement
  readonly image: HTMLImageElement
  readonly lqip: string
  readonly mesh: Mesh
  readonly texture: Texture
  /** 모달 같은 오버레이 안에 있는가. 하나라도 있으면 그것만 그린다. */
  readonly overlay: boolean
  /**
   * 스크롤 이동을 왜곡으로 받는가.
   *
   * 노선 스트립만 참이다. 아카이브 인덱스는 정돈이 목적이라, 읽는 동안 사진이
   * 계속 일렁이면 그 목적과 정면으로 부딪친다. 인덱스에서 왜곡은 커서가 만든다.
   */
  readonly motion: boolean
  /** 커서와의 거리. 프레임마다 계산해 그리기 직전에 프로그램으로 넘긴다. */
  focus: number
  /** 커서가 이 사진 위에 있는 정도(0~1). 불리언으로 두면 들고 날 때 튄다. */
  hover: number
  /** DOM 이미지를 숨겼는지. 인계는 사진 하나하나 단위로 일어난다. */
  handedOver: boolean
  /** 직전 프레임에서 이 사진이 화면 어디에 있었는지. 속도는 여기서 나온다. */
  lastCenter: { x: number; y: number } | null
  /** 이 사진이 지금 얼마나 빠르게 움직이는지. 뷰포트 비율/기준 프레임. */
  velocity: { x: number; y: number }
}

/** 모프 길이. 화이트 큐브의 이징 그대로 — 빠르게 떠나 천천히 안착한다. */
const MORPH_MS = 620
/** cubic-bezier(0.16, 1, 0.3, 1)에 가까운 감쇠. 바운스 없음. */
const easeOut = (t: number): number => 1 - (1 - t) ** 4

/**
 * 커서가 올라간 사진이 자기 자리 안에서 움직일 수 있는 여유.
 *
 * 사방으로 이만큼 들어앉고, 같은 만큼까지 커서 쪽으로 밀린다. 그래서 **어떤 경우에도
 * DOM이 잡아둔 자리를 넘지 않는다** — 테두리(`.link::after`)는 DOM이 그리므로
 * 제자리에 있고, 사진만 그 안에서 논다. 비율이 아니라 픽셀인 이유는 이것이
 * 사진 크기와 무관하게 성립해야 하기 때문이다.
 */
const HOVER_PLAY_PX = 3
/** 속도(뷰포트 비율/프레임)를 위 여유의 픽셀로 옮기는 배율. */
const HOVER_PUSH_GAIN = 200

/** `url("data:...")` 에서 URL만 꺼낸다. LQIP는 CSS 변수로 이미 DOM에 있다. */
function readCssUrl(value: string): string | null {
  const match = value.trim().match(/^url\(["']?(.+?)["']?\)$/)
  return match?.[1] ?? null
}

const clamp = (value: number, limit: number): number =>
  Math.max(-limit, Math.min(limit, value))

export class GlStage {
  private readonly renderer: Renderer
  private readonly camera: Camera
  private readonly scene = new Transform()
  private readonly pool: TexturePool
  private readonly geometry: Plane
  /**
   * 프로그램은 딱 하나다. 메시마다 Program을 만들면 같은 셰이더를 68번 컴파일하게 되고,
   * 그 비용이 인덱스 진입에서 메인 스레드를 100ms 넘게 잡는다.
   * 메시별로 다른 값은 그리기 직전에 onBeforeRender로 밀어 넣는다.
   */
  private readonly program: Program
  private readonly tracked: Tracked[] = []

  /** 진짜 커서가 달린 기기인가. 터치의 가짜 호버는 받지 않는다. */
  private readonly hoverQuery: MediaQueryList
  private hoverable: boolean

  private raf = 0
  private lastFrameAt = 0
  /** 캔버스의 CSS 박스. 이것이 GL 월드의 크기이자 원점이다. */
  private box = { left: 0, top: 0, width: 0, height: 0 }
  private velocity = { x: 0, y: 0 }
  private pointer: { x: number; y: number } | null = null
  private lastPointer: { x: number; y: number } | null = null
  private intensity = 1
  private running = false
  private morph: PendingMorph | null = null

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new Renderer({
      canvas,
      alpha: true,
      antialias: false,
      // 레티나에서 2를 넘길 이유가 없다. 3을 쓰면 픽셀이 2.25배 늘고 눈에는 차이가 없다.
      dpr: Math.min(window.devicePixelRatio, 2),
    })
    // 생성자가 곧바로 setSize(300, 150)을 부르며 인라인 크기를 박는다. 그대로 두면
    // CSS의 100%를 이겨서 캔버스가 300×150에 갇히고, measure()가 그 값을 다시 읽는다.
    this.releaseInlineSize()
    // 직교 카메라. 원근을 쓰면 fov와 카메라 거리를 맞춰야 1 world unit = 1 픽셀이 되는데,
    // 우리는 깊이가 없는 평면들을 DOM 좌표 그대로 놓을 뿐이라 그 계산이 순수한 위험이다.
    this.camera = new Camera(this.renderer.gl)
    this.camera.position.z = 1
    this.pool = new TexturePool(this.renderer.gl, textureBudget())
    this.geometry = new Plane(this.renderer.gl)
    this.program = new Program(this.renderer.gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      transparent: true,
      depthTest: false,
      uniforms: {
        tMap: { value: null },
        uVelocity: { value: [0, 0] },
        uIntensity: { value: 1 },
        uOpacity: { value: 1 },
        uFocus: { value: 1 },
      },
    })

    this.hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    this.hoverable = this.hoverQuery.matches
  }

  /**
   * 라우트가 바뀌면 추적하던 엘리먼트가 DOM에서 떨어져 나간다. 새 화면을 다시 훑되
   * 텍스처 풀은 그대로 둔다 — 같은 사진이 다음 화면에도 있으면 다시 올릴 이유가 없고,
   * 이 연속성이 Phase 4의 화면 간 모프가 서 있을 땅이다.
   */
  remount(root: ParentNode = document): void {
    for (const item of this.tracked) {
      item.mesh.setParent(null)
      // 떠나는 화면의 DOM 이미지는 원래대로 돌려놓는다.
      delete item.element.dataset['glReady']
    }
    this.tracked.length = 0
    // 새 화면은 좌표계가 통째로 다르다. 속도도 0에서 시작한다.
    this.velocity = { x: 0, y: 0 }
    this.lastPointer = null
    this.mount(root)

    /*
     * 모프의 시계는 여기서 출발한다. 클릭 시각에 맞추면 이동이 조금만 늦어져도
     * 새 화면이 그려지기 전에 애니메이션이 끝나 아무 일도 안 일어난 것처럼 보인다.
     * 넘어온 사진이 실제로 새 화면에 있을 때만 살린다.
     */
    if (this.morph) {
      const arrived = this.tracked.some((item) => item.key === this.morph?.key)
      if (arrived) this.morph.startedAt = performance.now()
      else this.morph = null
    }
  }

  /**
   * 이 사진이 지금 있는 자리를 기억해둔다. 다음 화면에서 여기서부터 이어 그린다.
   * 텍스처는 이미 GPU에 있으므로 전환 중에 이미지를 다시 받는 일이 없다.
   */
  beginMorph(key: string, from: DOMRect): void {
    this.morph = {
      key,
      from: { x: from.left, y: from.top, width: from.width, height: from.height },
      startedAt: 0,
    }
  }

  /** DOM에서 `[data-photo]`를 찾아 각각에 평면을 하나씩 붙인다. */
  mount(root: ParentNode = document): void {
    const gl = this.renderer.gl

    for (const element of root.querySelectorAll<HTMLElement>('[data-photo]')) {
      const key = element.dataset['photo']
      const image = element.querySelector('img')
      if (!key || !image) continue

      // LQIP는 이미 `--frame-lqip`으로 DOM에 있다. 다시 실어 보낼 이유가 없다.
      const lqip = readCssUrl(getComputedStyle(element).getPropertyValue('--frame-lqip'))
      if (!lqip) continue

      const texture = this.pool.acquire(key, lqip)
      const mesh = new Mesh(gl, { geometry: this.geometry, program: this.program })
      mesh.visible = false
      const item: Tracked = {
        key,
        element,
        image,
        lqip,
        mesh,
        texture,
        overlay: element.closest('[data-overlay]') !== null,
        motion: element.closest('[data-gl-motion]') !== null,
        focus: 1,
        hover: 0,
        handedOver: false,
        lastCenter: null,
        velocity: { x: 0, y: 0 },
      }

      // 공유 프로그램의 uniform을 이 메시가 그려지기 직전에 갈아 끼운다.
      mesh.onBeforeRender(() => {
        const uniforms = this.program.uniforms
        uniforms['tMap'].value = item.texture
        // 속도는 사진마다 다르다. 서로 다른 속도로 움직이는 것들이 각자 맞는 전단을 받는다.
        uniforms['uVelocity'].value = [item.velocity.x, item.velocity.y]
        uniforms['uIntensity'].value = this.intensity
        uniforms['uFocus'].value = item.focus
      })

      mesh.setParent(this.scene)
      this.tracked.push(item)
    }
  }

  get trackedCount(): number {
    return this.tracked.length
  }

  start(): void {
    if (this.running || this.tracked.length === 0) return
    this.running = true
    this.measure()
    this.lastFrameAt = 0

    window.addEventListener('pointermove', this.onPointer, { passive: true })
    // 창 밖으로 나가면 호버가 걸린 채로 남는다. 그 사진만 계속 들어앉아 있게 된다.
    window.addEventListener('pointerout', this.onPointerOut, { passive: true })
    this.hoverQuery.addEventListener('change', this.onHoverability)
    // 캡처 단계에서 듣는다. 라우터가 화면을 갈아치우기 전에 지금 자리를 재야 한다.
    document.addEventListener('click', this.onClick, true)
    document.documentElement.dataset['gl'] = 'on'
    this.raf = requestAnimationFrame(this.frame)
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    cancelAnimationFrame(this.raf)
    window.removeEventListener('pointermove', this.onPointer)
    window.removeEventListener('pointerout', this.onPointerOut)
    this.hoverQuery.removeEventListener('change', this.onHoverability)
    document.removeEventListener('click', this.onClick, true)
    delete document.documentElement.dataset['gl']
    delete document.documentElement.dataset['glSolo']
    // 넘겨받았던 사진들을 DOM에 돌려준다. 폴백은 늘 그 자리에 있었다.
    for (const item of this.tracked) {
      item.handedOver = false
      delete item.element.dataset['glReady']
    }
  }

  dispose(): void {
    this.stop()
    this.pool.dispose()
    this.tracked.length = 0
  }

  /** Colophon의 슬라이더가 만지는 값. 0이면 왜곡이 전부 사라진다. */
  setIntensity(value: number): void {
    this.intensity = Math.max(0, Math.min(1, value))
  }

  /**
   * 밖에서 들여다볼 수 있는 상태. 셰이더 안에서 일어나는 일은 눈으로도 스크린샷으로도
   * 잡기 어려우므로 최소한의 관측점을 남긴다. Colophon의 슬라이더와 e2e가 이걸 읽는다.
   */
  inspect(): {
    tracked: number
    textures: number
    promoted: number
    velocity: [number, number]
    intensity: number
    morphing: string | null
    solo: boolean
    /** GL 월드의 크기. 캔버스의 CSS 박스와 어긋나면 사진이 자리를 벗어난다. */
    viewport: [number, number]
    hovered: string | null
  } {
    return {
      tracked: this.tracked.length,
      textures: this.pool.size,
      promoted: this.pool.promoted,
      velocity: [this.velocity.x, this.velocity.y],
      intensity: this.intensity,
      morphing: this.morph?.key ?? null,
      solo: this.tracked.some((item) => item.overlay),
      viewport: [this.box.width, this.box.height],
      hovered: this.tracked.find((item) => item.hover > 0.5)?.key ?? null,
    }
  }

  /**
   * GL 월드를 캔버스의 실제 CSS 박스에 맞춘다.
   *
   * 예전엔 `window.innerWidth/innerHeight`를 썼다. 그런데 캔버스는 `position: fixed`에
   * `width: 100%`라 **스크롤바를 뺀 레이아웃 뷰포트**를 차지한다. 실측하면 월드 1280,
   * 상자 1265 — 배율 0.988이 걸려 오른쪽 끝 사진이 12px 왼쪽에 그려졌다.
   *
   * 모바일 사파리에서는 이게 훨씬 나빴다. 주소창이 접히며 `innerHeight`는 계속 변하는데
   * fixed 상자의 높이는 안 변해서, 스크롤하는 내내 세로 배율이 흔들렸다.
   *
   * 원점까지 상자에서 읽는 이유도 같다 — 상자가 뷰포트 좌상단에 있지 않은 상황이
   * 생겨도 `getBoundingClientRect()`와 어긋나지 않는다.
   */
  private measure(): void {
    const rect = this.canvas.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    this.box = { left: rect.left, top: rect.top, width, height }
    if (this.renderer.width === width && this.renderer.height === height) return

    this.renderer.setSize(width, height)
    this.releaseInlineSize()

    this.camera.orthographic({
      left: -width / 2,
      right: width / 2,
      bottom: -height / 2,
      top: height / 2,
      near: -100,
      far: 100,
    })
  }

  /**
   * OGL은 setSize마다 인라인 width/height를 쓴다. 그걸 지워 CSS의 `100%`가 계속
   * 주인이게 한다 — 남겨두면 `globals.css`의 `canvas { max-width: 100% }`가 그 값을
   * 다시 깎아, 그리기 버퍼보다 좁은 상자에 그림이 눌려 들어간다.
   */
  private releaseInlineSize(): void {
    this.canvas.style.removeProperty('width')
    this.canvas.style.removeProperty('height')
  }

  private readonly onPointer = (event: PointerEvent): void => {
    // 터치로 들어온 포인터는 호버가 아니다. 탭 한 번에 사진이 튀면 안 된다.
    if (event.pointerType === 'touch') {
      this.pointer = null
      return
    }
    this.pointer = { x: event.clientX, y: event.clientY }
  }

  /**
   * 커서가 창 밖으로 나갔다. `pointerleave`가 아니라 이걸 쓰는 이유는, 그쪽은 버블하지
   * 않아 document에 걸어도 오지 않는 경우가 있기 때문이다. relatedTarget이 없다는 건
   * 갈 곳이 문서 안에 없다는 뜻 — 요소 사이를 옮겨 다니는 건 여기 해당하지 않는다.
   */
  private readonly onPointerOut = (event: PointerEvent): void => {
    if (event.relatedTarget !== null) return
    this.pointer = null
  }

  private readonly onHoverability = (event: MediaQueryListEvent): void => {
    this.hoverable = event.matches
    if (!this.hoverable) this.pointer = null
  }

  /**
   * 사진을 눌러 다른 화면으로 갈 때, 지금 있는 자리를 재둔다.
   *
   * 새 탭·수정키 조합은 건드리지 않는다 — 이 화면이 그대로 남아 있는데
   * 사진만 어딘가로 날아가면 그건 전환이 아니라 오작동이다.
   */
  private readonly onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const target = event.target
    if (!(target instanceof Element)) return
    const holder = target.closest<HTMLElement>('[data-photo]')
    const key = holder?.dataset['photo']
    if (!holder || !key) return
    if (!this.tracked.some((item) => item.key === key)) return

    this.beginMorph(key, holder.getBoundingClientRect())
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.frame)

    /*
     * 상자를 매 프레임 잰다. 리사이즈 이벤트만 듣던 때는 모바일 주소창이 접히는
     * 중간 상태를 통째로 놓쳤다 — rect 68개를 이미 읽는 루프에서 하나 더 읽는 값이
     * 그 어긋남보다 훨씬 싸다.
     */
    this.measure()
    const { left: originX, top: originY, width, height } = this.box

    const elapsed = frameDelta(now, this.lastFrameAt)
    this.lastFrameAt = now

    /*
     * 커서가 이번 프레임에 움직인 양. 사진 위에 있을 때 그 사진의 속도가 된다.
     *
     * 이벤트마다 재지 않는다 — 포인터 이벤트는 120Hz로도 오고 합쳐지기도 해서
     * 프레임과 어긋난다. 스크롤 이동과 같은 단위여야 셰이더가 둘을 구분하지 않는다.
     */
    const cursor = { x: 0, y: 0 }
    if (this.hoverable && this.pointer && this.lastPointer) {
      cursor.x = perFrame((this.pointer.x - this.lastPointer.x) / width, elapsed)
      cursor.y = perFrame((this.pointer.y - this.lastPointer.y) / height, elapsed)
    }
    this.lastPointer = this.pointer ? { ...this.pointer } : null

    // 이 프레임에서 가장 빨리 움직인 값. inspect()가 이걸 보고한다.
    let fastest = { x: 0, y: 0 }
    let fastestSpeed = -1

    // 모프가 끝났으면 치운다. 진행 중이면 진행률을 구해둔다.
    let morphT = 1
    if (this.morph) {
      if (this.morph.startedAt === 0) morphT = 0
      else {
        morphT = Math.min(1, (now - this.morph.startedAt) / MORPH_MS)
        if (morphT >= 1) this.morph = null
      }
    }

    /*
     * 모달이 열리면 그 한 장만 그린다.
     *
     * 캔버스는 화면 전체를 덮는 fixed 엘리먼트라 모달 안에 넣을 수 없다. 모달의 사진을
     * 그리려면 캔버스가 베일보다 위로 올라가야 하는데, 그 상태에서 뒤쪽 그리드까지 그리면
     * 68장이 베일 위로 튀어나온다. 그래서 나머지는 그리지 않고 **DOM 이미지로 돌려준다** —
     * 안 그러면 베일 뒤에서 그리드가 통째로 사라진다.
     */
    const solo = this.tracked.some((item) => item.overlay)
    if (solo) document.documentElement.dataset['glSolo'] = ''
    else delete document.documentElement.dataset['glSolo']

    for (const item of this.tracked) {
      if (solo && !item.overlay) {
        item.mesh.visible = false
        // 이 사진을 건너뛰는 동안 위치를 잊는다. 안 그러면 모달이 닫히는 순간
        // 그동안 밀린 스크롤이 전부 한 프레임의 속도로 잡혀 화면이 튄다.
        item.lastCenter = null
        item.velocity = { x: 0, y: 0 }
        item.hover = 0
        if (item.handedOver) {
          item.handedOver = false
          delete item.element.dataset['glReady']
        }
        continue
      }

      let rect = item.element.getBoundingClientRect()
      const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }

      /*
       * 왜곡을 만드는 입력은 둘이고, 한 번에 하나만 이긴다.
       *
       * **커서** — 사진 위에서 손을 움직이면 그 방향으로 밀린다. 젖은 물감을 손가락으로
       * 쓸 때처럼 진행 방향과 같은 부호다.
       *
       * **스크롤** — DOM이 놓은 자리의 움직임에서 잰다. 창 스크롤이든 컨테이너 가로
       * 스크롤이든 같은 코드로 잡힌다. 사진이 밀려야 하는 방향은 DOM이 움직인 반대다.
       * 다만 이건 `data-gl-motion` 안, 즉 노선 스트립에서만 쓴다 — 아카이브 인덱스는
       * 읽는 화면이라 굴리는 내내 일렁이면 안 된다.
       *
       * 모프가 만든 이동은 어느 쪽에도 넣지 않는다. 넣으면 그리드에서 모달로 날아가는
       * 내내 자기 이동 때문에 사진이 계속 기울어 있다.
       */
      const hovered =
        this.hoverable &&
        this.pointer !== null &&
        this.pointer.x >= rect.left &&
        this.pointer.x <= rect.right &&
        this.pointer.y >= rect.top &&
        this.pointer.y <= rect.bottom

      let target = { x: 0, y: 0 }
      if (hovered) {
        target = cursor
      } else if (item.motion && item.lastCenter) {
        target = {
          x: perFrame(-(center.x - item.lastCenter.x) / width, elapsed),
          y: perFrame(-(center.y - item.lastCenter.y) / height, elapsed),
        }
      }

      const next = clampSpeed(
        advance(item.velocity.x, target.x, elapsed),
        advance(item.velocity.y, target.y, elapsed),
      )
      item.velocity = next
      // 스크롤을 안 받는 사진도 위치는 계속 기억한다. 잊으면 `motion`이 켜지는 순간
      // 그동안 밀린 이동이 한 프레임에 몰린다.
      item.lastCenter = center
      item.hover = advance(item.hover, hovered ? 1 : 0, elapsed)

      const speed = Math.hypot(item.velocity.x, item.velocity.y)
      if (speed > fastestSpeed) {
        fastestSpeed = speed
        fastest = { x: item.velocity.x, y: item.velocity.y }
      }

      /*
       * 넘어온 사진은 이전 화면에서 있던 자리부터 출발해 지금 자리로 이어진다.
       * DOMRect를 직접 섞는다 — 텍스처도 메시도 그대로이므로 전환 중에
       * 이미지를 다시 받거나 다시 올리는 일이 전혀 없다.
       */
      if (this.morph?.key === item.key && morphT < 1) {
        const k = easeOut(morphT)
        const from = this.morph.from
        const lerp = (a: number, b: number) => a + (b - a) * k
        rect = new DOMRect(
          lerp(from.x, rect.left),
          lerp(from.y, rect.top),
          lerp(from.width, rect.width),
          lerp(from.height, rect.height),
        )
      }

      /*
       * 화면 위아래로 반 화면까지만 살린다.
       * 이 띠를 넓히면 GPU에 동시에 올라가는 장수가 예산을 넘고, 그때부터 풀이
       * 매 프레임 올렸다 내렸다를 반복하며 텍스처 업로드로 프레임을 태운다.
       */
      const near = rect.bottom > -height * 0.5 && rect.top < height * 1.5 && rect.width > 0
      if (!near) {
        item.mesh.visible = false
        continue
      }

      // 화면에 들어온 것만 GPU에 올린다. 68장을 미리 디코딩하지 않는다.
      this.pool.activate(item.key)
      this.pool.promote(item.key, item.image)

      /*
       * 인계는 사진 하나하나 단위다.
       * 전역 스위치 하나로 DOM 이미지를 전부 숨기면, GL이 아직 그리지 못한
       * 사진까지 같이 사라져 화면에 구멍이 난다. 그릴 수 있게 된 것만 넘겨받는다.
       */
      const ready = this.pool.isReady(item.key)
      item.mesh.visible = ready
      if (ready !== item.handedOver) {
        item.handedOver = ready
        if (ready) item.element.dataset['glReady'] = ''
        else delete item.element.dataset['glReady']
      }
      if (!ready) continue

      /*
       * 커서가 올라간 사진은 사방으로 조금 들어앉고, 그만큼 손 쪽으로 밀린다.
       * 여유와 밀림의 상한이 같아서 DOM이 잡아둔 자리를 절대 넘지 않는다.
       */
      const play = HOVER_PLAY_PX * item.hover
      item.mesh.scale.set(
        Math.max(1, rect.width - play * 2),
        Math.max(1, rect.height - play * 2),
        1,
      )
      const pushX = clamp(item.velocity.x * HOVER_PUSH_GAIN, play)
      const pushY = clamp(item.velocity.y * HOVER_PUSH_GAIN, play)

      // DOM은 좌상단 원점이고 GL은 상자 중앙 원점이다. 그 차이만 옮긴다.
      item.mesh.position.x = rect.left + rect.width / 2 - (originX + width / 2) + pushX
      item.mesh.position.y = -(rect.top + rect.height / 2 - (originY + height / 2) + pushY)

      const dxp = (this.pointer?.x ?? -9999) - (rect.left + rect.width / 2)
      const dyp = (this.pointer?.y ?? -9999) - (rect.top + rect.height / 2)
      item.focus = Math.min(1, Math.hypot(dxp, dyp) / (width * 0.4))
    }

    // 밖에서 들여다볼 값은 가장 빨리 움직인 사진의 속도다.
    this.velocity = fastestSpeed > 0 ? fastest : { x: 0, y: 0 }

    this.pool.evict()
    this.renderer.render({ scene: this.scene, camera: this.camera })
  }
}

interface PendingMorph {
  readonly key: string
  readonly from: { x: number; y: number; width: number; height: number }
  /** 새 화면에 그 사진이 나타난 순간에 시작한다. 클릭 시각이 아니라. */
  startedAt: number
}
