import { expect, test } from '@playwright/test'
import { PHOTO_LIST, ROUTE_LIST } from '../../src/lib/photos'

/**
 * "정돈되어 있다"는 취향이 아니라 측정 가능한 성질이다 —
 * 모든 프레임이 같은 크기이고, 한 행의 프레임들이 같은 높이에서 시작하고,
 * 캡션이 그 정렬을 깨지 않는다. 여기서 검사하는 건 그 세 가지다.
 *
 * 이전 배치는 폭을 3/2/4로 순환시키고 세로로 밀어냈고, 그래서 이 셋 중
 * 어느 것도 성립하지 않았다.
 */

/** 인덱스의 모든 프레임 박스 좌표. GL이 읽는 것과 같은 값이다. */
async function frameBoxes(page: import('@playwright/test').Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-sheet] [data-photo]')].map((el) => {
      const r = el.getBoundingClientRect()
      return { top: Math.round(r.top + window.scrollY), width: Math.round(r.width), height: Math.round(r.height) }
    }),
  )
}

test('모든 프레임이 같은 크기다', async ({ page }) => {
  await page.goto('/')
  const boxes = await frameBoxes(page)
  expect(boxes.length).toBe(PHOTO_LIST.length)

  const widths = new Set(boxes.map((b) => b.width))
  const heights = new Set(boxes.map((b) => b.height))
  expect([...widths], '폭이 한 종류여야 한다').toHaveLength(1)
  expect([...heights], '높이가 한 종류여야 한다').toHaveLength(1)
})

test('한 행의 프레임은 같은 높이에서 시작한다', async ({ page }) => {
  await page.goto('/')

  /*
   * 노선(=그리드 컨테이너)마다 모든 칸을 top 값으로 묶는다. 칸에는 사진과
   * 구간 구분 카드가 함께 들어간다 — 카드가 흐름을 끊지 않는 게 이 설계의 요점이다.
   *
   * 세로 밀림이 있으면 칸마다 top이 달라져 행 하나에 한 칸씩 들어가고,
   * "마지막을 뺀 모든 행이 꽉 차 있다"는 조건이 곧바로 깨진다.
   *
   * **`offsetTop`으로 잰다.** 여기서 보려는 건 그리드가 잡아준 **레이아웃**이지
   * 지금 화면에 그려진 자리가 아니다. `getBoundingClientRect()`는 transform을
   * 반영하는데, 스크롤 등장 애니메이션이 아직 안 끝난 칸은 12px 내려가 있어서
   * 같은 행이 두 무리로 쪼개진다 — 정렬은 멀쩡한데 테스트만 깨진다.
   */
  const sheets = await page.evaluate(() => {
    const bySheet = new Map<Element, number[]>()
    for (const el of document.querySelectorAll('[data-sheet] [data-photo], [data-sheet] [data-leg-mark]')) {
      // 사진은 래퍼 안에 있고 구분 카드는 그 자체가 칸이다.
      const cell = el.hasAttribute('data-leg-mark') ? el : el.parentElement!
      const sheet = cell.parentElement!
      const top = (cell as HTMLElement).offsetTop
      bySheet.set(sheet, [...(bySheet.get(sheet) ?? []), top])
    }
    return [...bySheet.values()].map((tops) => {
      const rows = new Map<number, number>()
      for (const top of tops) rows.set(top, (rows.get(top) ?? 0) + 1)
      return { total: tops.length, rows: [...rows.values()] }
    })
  })

  expect(sheets, '노선 수만큼 그리드가 있어야 한다').toHaveLength(ROUTE_LIST.length)

  const columns = Math.max(...sheets.flatMap((s) => s.rows))
  expect(columns, '한 행에 두 칸도 못 놓이면 정렬이랄 게 없다').toBeGreaterThan(1)

  for (const sheet of sheets) {
    // 마지막 행만 덜 찰 수 있다. 나머지가 덜 찼다면 무언가 행을 깨뜨리고 있다.
    for (const row of sheet.rows.slice(0, -1)) {
      expect(row, `행이 ${columns}칸으로 꽉 차야 한다`).toBe(columns)
    }
    expect(sheet.rows.at(-1)!).toBeLessThanOrEqual(columns)
    expect(sheet.rows.length).toBe(Math.ceil(sheet.total / columns))
  }
})

test('빈 칸이 거의 없다 — 구분 카드가 그리드를 끊지 않는다', async ({ page }) => {
  await page.goto('/')

  const { cells, rows, columns } = await page.evaluate(() => {
    // 위와 같은 이유로 offsetTop이다 — 레이아웃을 보는 것이지 그려진 자리를 보는 게 아니다.
    const tops = [...document.querySelectorAll('[data-sheet] [data-photo], [data-sheet] [data-leg-mark]')].map((el) => {
      const cell = (el.hasAttribute('data-leg-mark') ? el : el.parentElement!) as HTMLElement
      return cell.offsetTop
    })
    const byTop = new Map<number, number>()
    for (const top of tops) byTop.set(top, (byTop.get(top) ?? 0) + 1)
    return { cells: tops.length, rows: byTop.size, columns: Math.max(...byTop.values()) }
  })

  // 구간마다 그리드를 끊던 시절에는 91칸 중 23칸이 비어 있었다.
  // 이어 붙인 지금은 노선 끝의 자투리만 남아야 한다.
  const empty = rows * columns - cells
  expect(empty, `빈 칸 ${empty}개 — 노선 수보다 많으면 어딘가 행을 끊고 있다`).toBeLessThan(
    columns * ROUTE_LIST.length,
  )
})

test('캡션 높이가 전부 같다 — 제목 길이가 정렬을 깨지 않는다', async ({ page }) => {
  await page.goto('/')
  const heights = await page.evaluate(() =>
    [...document.querySelectorAll('[data-sheet] [data-photo]')].map((el) =>
      Math.round(el.parentElement!.querySelector('p')!.getBoundingClientRect().height),
    ),
  )
  expect([...new Set(heights)]).toHaveLength(1)
})

test('노선과 구간이 섹션으로 나뉘고 개수가 맞는다', async ({ page }) => {
  await page.goto('/')

  for (const route of ROUTE_LIST) {
    await expect(page.getByRole('heading', { level: 2, name: route.title })).toBeVisible()
  }

  const legs = ROUTE_LIST.flatMap((r) => r.legs)
  await expect(page.locator('[data-leg-mark]')).toHaveCount(legs.length)

  // 노선마다 하나 + 구간마다 하나. 한 장짜리 구간은 단수로 쓴다.
  const counts = await page.evaluate(() =>
    [...document.querySelectorAll('main span')]
      .map((el) => el.textContent ?? '')
      .filter((t) => /^\d+ frames?$/.test(t)),
  )
  expect(counts).toHaveLength(ROUTE_LIST.length + legs.length)
  expect(counts, '한 장이면 frame, 여러 장이면 frames').not.toContain('1 frames')
})

test('카탈로그 번호가 001부터 순서대로 붙는다', async ({ page }) => {
  await page.goto('/')
  const numbers = await page.evaluate(() =>
    [...document.querySelectorAll('[data-sheet] [data-photo]')].map(
      (el) => el.parentElement!.querySelector('p span span')!.textContent,
    ),
  )
  expect(numbers[0]).toBe('001')
  expect(numbers.at(-1)).toBe(String(numbers.length).padStart(3, '0'))
  expect(numbers).toEqual(numbers.map((_, i) => String(i + 1).padStart(3, '0')))
})

test('고정된 노선 헤더가 사이트 헤더에 가리지 않는다', async ({ page, isMobile }) => {
  test.skip(isMobile, '좁은 화면에서는 노선 헤더를 고정하지 않는다')
  await page.setViewportSize({ width: 1440, height: 800 })
  await page.goto('/')

  /*
   * 고정 좌표로 굴리지 않는다. 여는 한 장이 들어오면서 1200px가 노선 안쪽이 아니라
   * 엉뚱한 자리가 됐고, 그때 붙어 있는 헤더가 없어 테스트가 아무것도 못 찾았다.
   * 노선 안으로 확실히 들어가는 자리를 실측해서 간다.
   */
  await page.evaluate(() => {
    const section = [...document.querySelectorAll('h2')].at(-1)!.closest('section') as HTMLElement
    window.scrollTo(0, section.offsetTop + 400)
  })
  await page.waitForTimeout(200)

  /*
   * --chrome-h는 손으로 적은 상수다. 헤더가 자라면 조용히 어긋나 노선 이름이
   * 반쯤 잘린 채로 남는다. 실제 좌표로 검사한다.
   */
  const gap = await page.evaluate(() => {
    const chrome = document.querySelector('header')!.getBoundingClientRect()
    const route = [...document.querySelectorAll('h2')]
      .map((h) => h.parentElement!.getBoundingClientRect())
      .filter((r) => r.top < 400)
      .sort((a, b) => b.top - a.top)[0]
    return route ? Math.round(route.top - chrome.bottom) : null
  })

  expect(gap, '고정된 노선 헤더를 못 찾았다').not.toBeNull()
  expect(gap, `사이트 헤더와 ${gap}px 겹친다`).toBeGreaterThanOrEqual(0)
  expect(gap, `사이트 헤더와 ${gap}px 벌어졌다 — 상수가 낡았다`).toBeLessThan(8)
})

test('좁은 화면에서도 균일함이 유지된다', async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 })
  await page.goto('/')
  const boxes = await frameBoxes(page)
  expect([...new Set(boxes.map((b) => b.width))]).toHaveLength(1)
})
