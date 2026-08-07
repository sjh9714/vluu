/**
 * 런칭 셀렉 — 원본 90프레임 중 무엇을 싣고 무엇을 뺐는지.
 *
 * 여기 있는 건 `photos-src/**` 안의 파일명(확장자 제외)뿐이다.
 * 카메라·촬영일시·좌표 같은 건 전부 ingest가 EXIF에서 읽으므로 여기 적지 않는다.
 * 뺀 프레임도 이유와 함께 남겨둔다 — 나중에 왜 뺐는지 다시 묻지 않기 위해서고,
 * `verify-media`가 "뺀 게 실수로 다시 들어오지 않았는지"를 검사하는 근거이기도 하다.
 */

/** 실을 프레임. 순서는 큐레이션이 아니라 파일명순 — 순서는 `collections.ts`가 정한다. */
export const SELECTED = [
  '155262',
  '155263',
  'IMG_3220',
  'IMG_3221',
  'IMG_3293',
  'IMG_3575',
  'IMG_3655',
  'IMG_3746',
  'IMG_3777',
  'IMG_4198',
  'IMG_5290',
  'IMG_5301',
  'IMG_5312',
  'IMG_5342',
  'IMG_5346',
  'IMG_5387',
  'IMG_5401',
  'IMG_5406',
  'IMG_5446',
  'IMG_5457',
  'IMG_5479',
  'IMG_5492',
  'IMG_5496',
  'IMG_5509',
  'IMG_5510',
  'IMG_5547',
  'IMG_5556',
  'IMG_5565',
  'IMG_5567',
  'IMG_5581',
  'IMG_5582',
  'IMG_5585',
  'IMG_5586',
  'IMG_5588',
  'IMG_5592',
  'IMG_5596',
  'IMG_5598',
  'IMG_5601',
  'IMG_5612',
  'IMG_5621',
  'IMG_5622',
  'IMG_5631',
  'IMG_5652',
  'IMG_5653',
  'IMG_5659',
  'IMG_5667',
  'IMG_5674',
  'IMG_5688',
  'IMG_5690',
  'IMG_5700',
  'IMG_5706',
  'IMG_5707',
  'IMG_5718',
  'IMG_5727',
  'IMG_5743',
  'IMG_5749',
  'IMG_5780',
  'IMG_5805',
  'IMG_5822',
  'IMG_5857',
  'IMG_5866',
  'IMG_5886',
  'IMG_5890',
  'IMG_5903',
  'IMG_5907',
  'IMG_5911',
  'IMG_5914',
  'IMG_5920',
] as const;

/** 뺀 프레임과 그 이유. */
export const EXCLUDED: Readonly<Record<string, string>> = {
  IMG_3489: '어두운 원경 야경 — 정보량이 적다',
  IMG_3581: '교토 골목 컷이 겹친다',
  IMG_3678: '평범한 수면 반영',
  IMG_3796: 'IMG_3220과 같은 골목 계열',
  IMG_3876: '테마파크 세트 — 톤이 튄다',
  IMG_3913: '저작권 있는 캐릭터가 주제',
  IMG_4034: '테마파크 세트 — 톤이 튄다',
  IMG_4044: 'IMG_4034와 같은 대상',
  IMG_4073: '브랜드 로고가 주제',
  IMG_5303: 'IMG_5301과 같은 스티커 기둥',
  IMG_5389: '카페 실내 — 직원 얼굴이 식별된다',
  IMG_5487: 'IMG_5457과 같은 다리',
  IMG_5516: '야간 상점가 — 얼굴이 식별된다',
  IMG_5570: '음식 사진 — 톤이 튄다',
  IMG_5589: '전시장 액자 속 타인의 작품',
  IMG_5613: 'IMG_5612와 거의 같은 프레임',
  IMG_5619: '역광 플레어로 흐리다',
  IMG_5702: '좌석 뒤통수만 남았다',
  IMG_5711: '평범한 호수',
  IMG_5811: '후지산 로프웨이 컷이 겹친다',
  IMG_5828: 'IMG_5811과 같은 대상',
  IMG_5943: '평범한 도심 컷 — 이 셀렉에서 유일하게 가로',
};

/** 촬영 원본 전체 — 셀렉과 제외를 합치면 이 수가 나와야 한다. */
export const TOTAL_FRAMES = 90;

export type SelectedSource = (typeof SELECTED)[number];

/** 파일명이 셀렉에 들어있는지. ingest가 `photos-src/**`를 훑으며 쓴다. */
const selectedSet: ReadonlySet<string> = new Set(SELECTED);
export function isSelected(source: string): boolean {
  return selectedSet.has(source);
}
