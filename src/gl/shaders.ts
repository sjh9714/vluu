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

// 스크롤·드래그 속도. x는 수평, y는 수직. 픽셀/프레임을 정규화한 값.
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

void main() {
  vec2 uv = vUv;

  // 배럴: 중심에서 멀수록 바깥으로. 속도가 붙을 때만 나타난다.
  vec2 centered = uv - 0.5;
  float r2 = dot(centered, centered);
  uv = 0.5 + centered * (1.0 + r2 * vBend * 0.35 * uIntensity);

  // 색수차. 1.5픽셀을 넘기지 않는다 — 넘는 순간 광학이 아니라 효과로 보인다.
  vec2 shift = uVelocity * 0.0035 * uIntensity;
  float r = texture2D(tMap, uv + shift).r;
  vec4 g = texture2D(tMap, uv);
  float b = texture2D(tMap, uv - shift).b;

  vec3 color = vec3(r, g.g, b);

  // 커서 근처는 아주 조금 또렷해진다. 밝아지는 게 아니라 대비가 선다.
  float sharpen = (1.0 - uFocus) * 0.12 * uIntensity;
  color = clamp(color + (color - 0.5) * sharpen, 0.0, 1.0);

  gl_FragColor = vec4(color, g.a * uOpacity);
}
`
