import { Archivo, DM_Mono } from 'next/font/google'

/**
 * Archivo — 미국식 그로테스크. Inter류의 무성격한 중립보다 골격이 단단하고,
 * 사진들의 인프라 기하학(고가도로·철교·표지판)과 같은 등록부에 있다.
 * 가변 wdth 축(62–125)을 함께 받는다 — 폭 자체를 모션에 쓸 수 있다.
 */
export const display = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-display',
})

/**
 * DM Mono — EXIF 스트립용. JetBrains Mono보다 획이 가늘어
 * 10–11px에서 사진 옆에 놓아도 소리를 지르지 않는다.
 */
export const mono = DM_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  display: 'swap',
  variable: '--font-mono',
})
