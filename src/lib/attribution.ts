/**
 * 지도 타일의 표기 문구.
 *
 * 화면에 반드시 있어야 한다 — 고르는 문제가 아니라 라이선스 조건이다.
 * OpenStreetMap 데이터는 ODbL이고 CARTO는 그 위에 스타일을 얹어 배포한다.
 *
 * 굽는 쪽(`scripts/lib/basemap.ts`)과 보여주는 쪽이 같은 문자열을 봐야 한다 —
 * 타일 출처를 바꾸면서 화면의 문구를 안 고치면 그 순간부터 거짓 표기가 된다.
 */
export const ATTRIBUTION = '© OpenStreetMap contributors © CARTO'
