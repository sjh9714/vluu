/**
 * 화이트 큐브의 셰이더 문법.
 *
 * 순백 바닥에서는 글로우도 블룸도 어두운 파티클도 전부 죽는다. 그래서 여기서
 * 쓰는 건 빛이 아니라 **광학의 실수**다 — 속도에 밀린 전단, 렌즈 가장자리의
 * 배럴 왜곡, 1픽셀 남짓의 색수차. 인쇄물과 측량 도구의 정밀함 쪽 언어다.
 *
 * 모든 효과는 uniform 하나로 0까지 내려갈 수 있다. 그래야 캔버스를 끄는 순간과
 * 켜는 순간이 이어지고, Colophon에서 슬라이더로 만져볼 수도 있다.
 */

export const VERTEX = /* glsl */ `
attribute vec2 uv;
attribute vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

// 이 사진이 지금 얼마나 빠르게 움직이는가. 스크롤이 밀었든 커서가 밀었든 같은 단위다 —
// **뷰포트 비율 / 60fps 한 프레임.** 프레임당 픽셀로 두면 프레임이 길어질 때 왜곡이
// 같이 커져서, 느린 기기에서 사진이 이유 없이 떤다.
uniform vec2 uVelocity;
uniform float uIntensity;

varying vec2 vUv;
varying float vBend;

void main() {
  vUv = uv;

  vec3 pos = position;

  // 속도가 붙으면 평면이 진행 방향으로 밀린다. 위아래 가장자리가 더 많이 밀려
  // 사각형이 평행사변형 쪽으로 기운다 — 셔터가 늦게 닫힌 것처럼.
  float edge = position.y * 2.0;
  pos.x += uVelocity.x * edge * 0.16 * uIntensity;

  float edgeX = position.x * 2.0;
  pos.y += uVelocity.y * edgeX * 0.16 * uIntensity;

  // 진행 방향으로 살짝 눌린다. 늘어나는 게 아니라 눌리는 쪽이 물리적으로 맞다.
  float speed = length(uVelocity);
  pos.xy *= 1.0 - speed * 0.05 * uIntensity;

  vBend = speed;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

export const FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D tMap;
uniform vec2 uVelocity;
uniform float uIntensity;
uniform float uOpacity;
// 커서와의 거리. 0이면 커서 아래, 1이면 멀다.
uniform float uFocus;

varying vec2 vUv;
varying float vBend;

// 방향성 번짐에 쓸 샘플 수. 홀수여야 가운데 샘플이 원본 자리에 놓인다.
// 샘플이 적으면 번짐이 아니라 유령 복사본이 줄지어 보인다.
const int SMEAR_SAMPLES = 7;

void main() {
  vec2 uv = vUv;

  // 배럴: 중심에서 멀수록 바깥으로. 속도가 붙을 때만 나타난다.
  vec2 centered = uv - 0.5;
  float r2 = dot(centered, centered);
  uv = 0.5 + centered * (1.0 + r2 * vBend * 0.35 * uIntensity);

  // 색수차. 1.5픽셀을 넘기지 않는다 — 넘는 순간 광학이 아니라 효과로 보인다.
  vec2 shift = uVelocity * 0.0035 * uIntensity;

  float speed = length(uVelocity);
  vec3 color;
  float alpha;

  /*
   * 분기 조건이 uniform이므로 한 드로우 안의 모든 픽셀이 같은 길을 간다 —
   * 워프가 갈리지 않아 비용이 거의 없다. 정지 상태에서 다섯 번 읽는 낭비를 피하려는 것이다.
   */
  if (speed * uIntensity > 0.0015) {
    /*
     * 진행 방향으로 번진다. 셔터가 늦게 닫힌 자국이지 발광 효과가 아니다 —
     * 흰 바닥에서 글로우는 죽고 광학의 실수만 읽힌다.
     *
     * 값이 작은 이유가 있다. 처음엔 1.1배에 상한 0.09로 잡았는데, 이미지 폭의 9%를
     * 일곱 번도 안 되는 샘플로 훑으니 번짐이 아니라 유령 복사본이 줄지어 나왔다.
     * 실제 스크롤에서 나오는 속도는 0.04 언저리다 — 거기서 5px쯤 끌리는 게
     * 셔터가 늦게 닫힌 것처럼 보이는 지점이고, 상한은 그보다 빨리 굴렸을 때를 막는다.
     */
    vec2 smear = clamp(uVelocity * 0.30, -0.022, 0.022) * uIntensity;

    vec3 acc = vec3(0.0);
    alpha = 0.0;
    for (int i = 0; i < SMEAR_SAMPLES; i++) {
      float t = float(i) / float(SMEAR_SAMPLES - 1) - 0.5;
      vec2 at = uv + smear * t;
      acc.r += texture2D(tMap, at + shift).r;
      vec4 mid = texture2D(tMap, at);
      acc.g += mid.g;
      acc.b += texture2D(tMap, at - shift).b;
      alpha += mid.a;
    }
    color = acc / float(SMEAR_SAMPLES);
    alpha /= float(SMEAR_SAMPLES);
  } else {
    float r = texture2D(tMap, uv + shift).r;
    vec4 g = texture2D(tMap, uv);
    float b = texture2D(tMap, uv - shift).b;
    color = vec3(r, g.g, b);
    alpha = g.a;
  }

  // 커서 근처는 아주 조금 또렷해진다. 밝아지는 게 아니라 대비가 선다.
  float sharpen = (1.0 - uFocus) * 0.12 * uIntensity;
  color = clamp(color + (color - 0.5) * sharpen, 0.0, 1.0);

  gl_FragColor = vec4(color, alpha * uOpacity);
}
`
