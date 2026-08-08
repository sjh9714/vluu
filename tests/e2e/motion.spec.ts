import { expect, test, type Page } from '@playwright/test'

/**
 * 스크롤과 화면 전환의 모션.
 *
 * 둘 다 **컴포지터에서 도는 것**을 골랐다. 이 사이트에서 걷어낸 모션은 전부 메인 스레드의
 * rAF가 컴포지터가 굴리는 스크롤을 쫓다 진 것들이었다 — 그 실패를 구조적으로 반복할 수
 * 없는 쪽이라는 게 이 선택의 근거다.
 *
 * 그래서 여기서 검사하는 건 "움직이는가"가 아니라 **무엇을 대가로 치르지 않았는가**다:
 * 첫 화면 사진은 건드리지 않았는지, 방향이 뒤바뀌지 않았는지, 헤더가 흔들리지 않는지.
 */

/** 전환 중에만 존재하는 가짜 엘리먼트에서 실제로 도는 애니메이션 이름을 잡는다. */
async function watchTransition(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __vt: string[] }
    w.__vt = []
    const original = document.startViewTransition?.bind(document)
    if (!original) return
    document.startViewTransition = (cb: () => void) => {
      const transition = original(cb)
      void transition.ready
        .then(() => {
          for (const animation of document.getAnimations()) {
            const pseudo = (animation.effect as KeyframeEffect | null)?.pseudoElement
            const name = (animation as CSSAnimation).animationName
            if (pseudo && name) w.__vt.push(name)
          }
        })
        .catch(() => {})
      return transition
    }
  })
}

const seen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __vt: string[] }).__vt)

test.describe('화면에 들어올 때 앉는다', () => {
  test('첫 화면 사진은 건드리지 않는다', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(600)

    /*
     * LCP가 빠른 건 첫 화면 사진이 곧바로 칠해지기 때문이다. 거기에 페이드를 걸면
     * 그 숫자가 무너진다.
     *
     * 지금 첫 화면을 차지하는 건 흐르는 띠다. 띠 자체는 움직이지만 **사진 한 장 한 장은**
     * 등장 애니메이션의 대상이 아니어야 하고 처음부터 다 보여야 한다. 움직임은
     * `.track` 하나에만 걸려 있으므로 사진에서 재면 0이 나온다.
     */
    const hero = await page.evaluate(() => {
      const shot = document.querySelector<HTMLImageElement>('[data-banner] img')!
      return {
        arrives: shot.closest('.vluu-arrive') !== null,
        opacity: Number(getComputedStyle(shot).opacity),
        animations: shot.getAnimations().length,
        onFirstScreen: shot.getBoundingClientRect().top < window.innerHeight,
      }
    })

    expect(hero.onFirstScreen, '띠가 첫 화면에 없다').toBe(true)
    expect(hero.arrives, '띠의 사진에 등장 애니메이션이 걸렸다').toBe(false)
    expect(hero.animations, '띠의 사진 한 장이 따로 애니메이션 중이다').toBe(0)
    expect(hero.opacity).toBe(1)

    /*
     * 격자 프레임도 **다 들어와 있으면** 최종 상태여야 한다.
     *
     * 아래 끝에 걸친 프레임은 뺀다. `animation-range: entry 0% cover 15%`는 아직
     * 들어오는 중인 프레임을 흐리게 두는 게 목적이고, 배너가 옛 여는 한 장보다 낮아
     * 첫 줄이 접힌 자리에 걸친다 — 거기서 0.4가 나오는 건 규칙이 도는 증거다.
     * 완전히 들어온 것만 보면 임의의 문턱값 없이 "다 왔으면 다 보인다"를 잰다.
     */
    const visible = await page.evaluate(() =>
      [...document.querySelectorAll('.vluu-arrive')]
        .filter((n) => n.getBoundingClientRect().bottom <= window.innerHeight)
        .map((n) => Number(getComputedStyle(n).opacity)),
    )
    expect(visible.every((o) => o === 1), `다 들어온 프레임이 흐리다: ${visible}`).toBe(true)
  })

  test('아래쪽 사진은 스크롤에 묶여 있다', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(600)

    const below = await page.evaluate(() => {
      const frames = [...document.querySelectorAll('.vluu-arrive')].filter(
        (n) => n.getBoundingClientRect().top >= window.innerHeight * 1.5,
      )
      return frames.slice(0, 3).map((n) => ({
        opacity: Number(getComputedStyle(n).opacity),
        // 스크롤에 묶였으면 타임라인이 ViewTimeline이다. JS 타이머면 DocumentTimeline이다.
        timeline: n.getAnimations()[0]?.timeline?.constructor.name ?? null,
      }))
    })

    expect(below.length).toBeGreaterThan(0)
    for (const frame of below) {
      expect(frame.timeline, '스크롤이 아니라 시간에 묶여 있다').toBe('ViewTimeline')
      expect(frame.opacity, '아래쪽 사진이 이미 다 나타나 있다').toBeLessThan(1)
    }
  })

  test('굴려 내려가면 나타난다', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(600)

    const key = await page.evaluate(() => {
      const frame = [...document.querySelectorAll('.vluu-arrive')].find(
        (n) => n.getBoundingClientRect().top >= window.innerHeight * 1.5,
      )!
      frame.setAttribute('data-probe', '')
      return Number(getComputedStyle(frame).opacity)
    })
    expect(key).toBeLessThan(1)

    await page.locator('[data-probe]').scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)

    expect(
      await page.evaluate(() => Number(getComputedStyle(document.querySelector('[data-probe]')!).opacity)),
    ).toBe(1)
  })
})

test.describe('화면을 옮길 때 방향이 생긴다', () => {
  test('안으로 갈 때와 나올 때가 반대다', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(600)

    await watchTransition(page)
    await page.getByLabel('Routes').getByRole('link', { name: 'Kantō' }).click()
    await page.waitForURL('**/c/kanto')
    await page.waitForTimeout(500)

    const forward = await seen(page)
    expect(forward, '앞으로 가는데 옛 화면이 왼쪽으로 안 나간다').toContain('vluu-slide-out-left')
    expect(forward).toContain('vluu-slide-in-right')

    await watchTransition(page)
    await page.getByLabel('Routes').getByRole('link', { name: 'Index' }).click()
    await page.waitForURL(/\/$/)
    await page.waitForTimeout(500)

    // 방향이 뒤바뀌면 앞으로 간 건지 돌아온 건지 화면이 거짓말을 한다.
    const back = await seen(page)
    expect(back).toContain('vluu-slide-out-right')
    expect(back).toContain('vluu-slide-in-left')
  })

  test('헤더는 움직이지 않는다', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(600)

    /*
     * 헤더가 같이 미끄러지면 붙잡을 기준점이 사라져서 "내용이 바뀌었다"가 아니라
     * "화면이 흔들렸다"로 읽힌다. 이름을 붙여두고 그 그룹의 애니메이션을 껐다.
     */
    expect(
      await page.evaluate(() => getComputedStyle(document.querySelector('header')!).viewTransitionName),
    ).toBe('site-header')

    await watchTransition(page)
    await page.getByLabel('Routes').getByRole('link', { name: 'Kansai' }).click()
    await page.waitForURL('**/c/kansai')
    await page.waitForTimeout(500)

    const ran = await seen(page)
    expect(ran.length, '전환 자체가 안 돌았다').toBeGreaterThan(0)
    // 헤더 그룹은 animation:none이라 도는 애니메이션 목록에 나오면 안 된다.
    expect(ran.some((n) => n.includes('site-header'))).toBe(false)
  })

  test('사진을 열 때는 화면이 미끄러지지 않는다', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(600)

    /*
     * 모달은 인터셉트 라우트라 인덱스가 언마운트되지 않는다. 그래서 전환 자체가 시작되지
     * 않고, 방향 애니메이션도 없다 — 사진 하나를 여는데 화면 전체가 미끄러지면 그건
     * 이동이 아니라 오작동이다. 이 자리는 모프가 맡는다.
     */
    await watchTransition(page)
    await page.locator('[data-photo]').first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.waitForTimeout(400)

    expect(await seen(page), '사진을 여는데 화면이 미끄러졌다').toEqual([])
  })
})

test('모션을 끈 사람에게는 전부 없다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForTimeout(500)

  // 등장은 아예 걸리지 않는다 — 아래쪽 사진도 처음부터 또렷하다.
  const opacities = await page.evaluate(() =>
    [...document.querySelectorAll('.vluu-arrive')].map((n) => Number(getComputedStyle(n).opacity)),
  )
  expect(opacities.every((o) => o === 1), '모션을 껐는데 사진이 흐리다').toBe(true)
})
