#version 300 es
precision highp float;

uniform vec2 resolution;
uniform float iTime;

out vec4 fragColor;

const int MODE_SINGLE = 1;
const int MODE_GRID = 2;
const int MODE = 2;

const float PI = 3.14159265359;
vec2 squareFrame(vec2 screenSize, vec2 coord) {
  vec2 position = 2.0 * (coord.xy / screenSize.xy) - 1.0;
  float aspect = screenSize.x / screenSize.y;
  return position * max(vec2(1.0), vec2(aspect, 1.0 / aspect));
}

float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

vec2 rotate2D(vec2 p, float a) {
  return p * mat2(cos(a), -sin(a), sin(a), cos(a));
}

// A capsule that takes length, position and rotation as input
// while the radius is fixed
float sdCapsuleFixed(vec2 p, vec2 pos, float len, float rot) {
  vec2 pa = p - pos;
  vec2 ba = vec2(cos(rot), sin(rot)) * len;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - 0.18125;
}

float aastep(float threshold, float value) {
  float afwidth = length(vec2(dFdx(value), dFdy(value))) * 0.70710678118654757;
  return smoothstep(threshold-afwidth, threshold+afwidth, value);
}


void pR(inout vec2 p, float a) {
  p = cos(a) * p + sin(a) * vec2(p.y, -p.x);
}

void pR45(inout vec2 p) {
  p = (p + vec2(p.y, -p.x)) * sqrt(0.5);
}

float sdBox(vec2 position, vec2 dimensions) {
  vec2 d = abs(position) - dimensions;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdRing(vec2 p, float r1, float r2) {
  float lp = length(p);
  return max(r1 - lp, lp - r2);
}

void pElongate(inout float p, float h) {
  p -= clamp(p, -h, h);
}

float letterV(vec2 p);

float letterA(vec2 p) {
  p.x = abs(p.x);
  float d = sdBox(p + vec2(0.0, 0.15), vec2(0.45, 0.08125));
  p.y = -p.y;
  return min(d, letterV(p));
}

float letterP(vec2 p);

float letterB(vec2 p) {
  p.y = abs(p.y);
  return letterP(p);
}

float letterC(vec2 p) {
  p.x -= 0.08;
  p.y = abs(p.y);
  vec2 q = p;
  p.x = abs(p.x);
  float d = sdRing(p, 0.9 - 0.08125 * 2.0, 0.9);
  q.x -= 0.7;
  pR45(q);
  d = max(d, -q.y + 0.5);
  return d;
}

float letterD(vec2 p) {
  p.x += 0.165;
  vec2 q = p;
  p.x += 0.45;
  float dEdge = sdBox(q + vec2(0.45, 0.0), vec2(0.08125, 0.8));
  pElongate(p.x, 0.45);
  float dBump = sdRing(p, 0.9 - 0.08125 * 2.0, 0.9);
  float d = min(dBump, dEdge);
  d = max(d, -q.x - 0.53);
  return d;
}

float letterF(vec2 p);

float letterE(vec2 p) {
  p.y = abs(p.y);
  return letterF(p);
}

float letterF(vec2 p) {
  p.x -= 0.25;
  float dTop = sdBox(p + vec2(0.25, -0.9 + 0.08125), vec2(0.65, 0.08125));
  float dMid = sdBox(p + vec2(0.4, 0.0), vec2(0.5, 0.08125));
  p.x += 0.9 - 0.08125;
  float dSide = sdBox(p, vec2(0.08125, 0.9));
  return min(dTop, min(dMid, dSide));
}

float letterG(vec2 p) {
  float d = letterC(p);
  d = min(d, sdBox(p + vec2(0.08125 - 0.75, 0.5), vec2(0.08125, 0.4)));
  d = min(d, sdBox(p + vec2(-0.5, 0.1 + 0.08125), vec2(0.2, 0.08125)));
  return d;
}

float letterH(vec2 p) {
  p.x = abs(p.x);
  float d = sdBox(p, vec2(0.6, 0.08125));
  p.x -= 0.6 - 0.08125;
  d = min(d, sdBox(p, vec2(0.08125, 0.9)));
  return d;
}

float letterI(vec2 p) {
  p.y = abs(p.y);
  float d = sdBox(p, vec2(0.08125, 0.9));
  p.y -= 0.9 - 0.08125;
  d = min(d, sdBox(p, vec2(0.3, 0.08125)));
  return d;
}

float letterJ(vec2 p) {
  p.x -= 0.35;
  float d = sdBox(p + vec2(0.0, -0.225), vec2(0.08125, 0.65));
  p.x += 0.3 + 0.08125;
  p.y += 0.5 - 0.08125;
  float dRing = sdRing(p, 0.3, 0.3 + 0.08125 * 2.0);
  dRing = max(dRing, p.y);
  d = min(d, dRing);
  return d;
}

float letterK(vec2 p) {
  p.x -= 0.1;
  vec2 q = p;
  float d = sdBox(p + vec2(0.6, 0.0), vec2(0.08125, 0.9));
  p.x += 0.5;
  p.y = abs(p.y);
  pR(p, 0.82);
  d = min(d, sdBox(p, vec2(1.5, 0.08125)));
  d = max(d, -0.9 + abs(q.y));
  return d;
}

float letterL(vec2 p) {
  p.x -= 0.25;
  float dTop = sdBox(p + vec2(0.25, 0.9 - 0.08125), vec2(0.65, 0.08125));
  p.x += 0.9 - 0.08125;
  float dSide = sdBox(p, vec2(0.08125, 0.9));
  return min(dTop, dSide);
}

float letterM(vec2 p) {
  vec2 q = p;
  p.x = abs(p.x);
  float d = sdBox(p - vec2(0.7, 0.0), vec2(0.08125, 0.9));
  pR(p, 1.1);
  p.y += 0.18;
  d = min(d, sdBox(p, vec2(1.3, 0.08125)));
  d = max(d, q.y - 0.9);
  return d;
}

float letterN(vec2 p) {
  vec2 q = p;
  vec2 m = p;
  p.x = abs(p.x);
  float d = sdBox(p - vec2(0.5, 0.0), vec2(0.08125, 0.9));
  pR(q, -1.07);
  p.y += 0.18;
  d = min(d, sdBox(q, vec2(1.3, 0.08125)));
  d = max(d, abs(m.y) - 0.9);
  return d;
}

float letterO(vec2 p) {
  pElongate(p.y, 0.25);
  float d = sdRing(p, 0.65 - 0.08125 * 2.0, 0.65);
  return d;
}

float letterP(vec2 p) {
  p.x -= 0.05;
  vec2 q = p;
  p.x += 0.45;
  float dEdge = sdBox(q + vec2(0.45, 0.0), vec2(0.08125, 0.9));
  pElongate(p.x, 0.45);
  float dBumps = sdRing(p - vec2(0.0, 0.5 - 0.08125), 0.48 - 0.08125 * 2.0, 0.48);
  float d = min(dBumps, dEdge);
  d = max(d, -q.x - 0.53);
  return d;
}

float letterQ(vec2 p) { 
  float d = letterO(p);
  p += vec2(-0.6, 0.85);
  pR45(p.yx);
  d = min(d, sdBox(p, vec2(0.225, 0.08125)));
  return d;
}

float letterR(vec2 p) {
  p.x += 0.05;
  vec2 q = p;
  float d = letterP(p);
  p.y += 0.5;
  p.x -= 0.25;
  pR(p, -0.9);
  d = min(d, sdBox(p, vec2(0.7, 0.08125)));
  d = max(d, -0.9 - q.y);
  return d;
}

float letterSPortion(vec2 p) {
  p.y -= 0.5 - 0.08125;
  float d0 = sdRing(p, 0.5 - 0.08125 * 2.0, 0.5);
  pR45(p);
  return max(d0, -p.y - 0.2);
}

float letterS(vec2 p) {
  pElongate(p.x, 0.125);
  float d = min(letterSPortion(p), letterSPortion(-p));
  pR(p, -0.19);
  d = min(d, sdBox(p, vec2(0.18, 0.08125)));
  return d;
}

float letterT(vec2 p) {
  float d = sdBox(p, vec2(0.08125, 0.9));
  p.y -= 0.9 - 0.08125;
  d = min(d, sdBox(p, vec2(0.6, 0.08125)));
  return d;
}

float letterU(vec2 p) {
  vec2 q = p;
  p.y -= 0.5;
  pElongate(p.y, 0.5);
  float d = letterO(p);
  return max(d, q.y - 0.9);
}

float letterV(vec2 p) {
  p.x = abs(p.x);
  p.x -= 0.35;
  float d = sdBox(rotate2D(p, -1.11), vec2(1.5, 0.08125));
  d = max(d, p.y - 0.9);
  return d;
}

float letterW(vec2 p) {
  p.y = -p.y;
  return letterM(p);
}

float letterX(vec2 p) {
  p = abs(p);
  vec2 q = p;
  pR(p, 0.9);
  float d = sdBox(p, vec2(1.5, 0.08125));
  d = max(d, q.y - 0.9);
  return d;
}

float letterY(vec2 p) {
  p.x = abs(p.x);
  vec2 q = p;
  pR(p, 0.9);
  float d = sdBox(p, vec2(1.5, 0.08125));
  d = min(d, sdBox(q + vec2(0.0, 0.5 - 0.08125), vec2(0.08125, 0.5)));
  d = max(d, abs(q.y) - 0.9);
  return d;
}

float letterZ(vec2 p) {
  p.x -= 0.04;
  vec2 q = p;
  vec2 m = p;
  p.y = abs(p.y);
  float d = sdBox(p - vec2(0.0, 0.9 - 0.08125), vec2(0.62, 0.08125));
  pR(q, 0.95);
  p.y += 0.18;
  d = min(d, sdBox(q, vec2(1.3, 0.08125)));
  d = max(d, abs(m.y) - 0.9);
  return d;
}


float digit0(vec2 p) {
  return letterO(p);
}

float digit1(vec2 p) {
  return sdCapsule(p, vec2(0.0, -0.9), vec2(0.0, 0.7), 0.18125);
}

// float digit1(vec2 p) {
//   p.x += 0.3;
//   float d = sdBox(p, vec2(0.08125, 0.9));
//   p.y -= 0.86 - 0.08125;
//   p.x += 0.06;
//   pR45(p);
//   d = min(d, sdBox(p + vec2(0.2, 0.0), vec2(0.3, 0.08125)));
//   return d;
// }

float digit2(vec2 p) {
  float d = sdCapsuleFixed(p, vec2(-0.3, 0.7), 0.8, 0.0);
  d = min(d, sdCapsuleFixed(p, vec2(0.5, 0.2), 0.05, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.2), 0.8, 0.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.6), 0.02, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.9), 0.8, 0.0));

  return d;
}

// Construct using sdCapsule, like in LED, digit2
float digit3(vec2 p) {
  float d = sdCapsuleFixed(p, vec2(-0.3, 0.7), 1.0, 0.0);
  d = min(d, sdCapsuleFixed(p, vec2(0.4, 0.0), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.2), 0.8, 0.0));
  d = min(d, sdCapsuleFixed(p, vec2(0.4, -0.9), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.9), 0.8, 0.0));
  return d;
}
// Construct using sdCapsule, like in LED, digit2
float digit4(vec2 p) {
  float d = sdCapsuleFixed(p, vec2(-0.3, 0.1), 1.0, 0.0);
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, 0.0), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(0.4, 0.0), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(0.4, -0.9), 1.0, PI/2.0));
  return d;
}

float digit5(vec2 p) {
  float d = sdCapsuleFixed(p, vec2(-0.1, 0.8), 0.8, 0.0);
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, 0.0), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.2, -0.0), 0.8, 0.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.9), 0.8, 0.0));
  d = min(d, sdCapsuleFixed(p, vec2(0.4, -0.9), 1.0, PI/2.0));
  return d;
}


// Also using sdCapsuleFixed
float digit6(vec2 p) {
  float d = sdCapsuleFixed(p, vec2(-0.3, 0.7), 1.0, 0.0);
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, 0.0), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(0.1, -0.0), 0.4, 0.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.9), 0.8, 0.0));
  d = min(d, sdCapsuleFixed(p, vec2(0.4, -0.9), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.9), 1.0, PI/2.0));
  return d;
}

float digit7(vec2 p) {
  float d = sdCapsuleFixed(p, vec2(-0.3, 0.7), 1.0, 0.0);
  d = min(d, sdCapsuleFixed(p, vec2(0.0, -0.9), 2.0, PI/2.5));
  return d;
}

float digit8(vec2 p) {
  float d = sdCapsuleFixed(p, vec2(-0.3, 0.7), 1.0, 0.0);
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, 0.0), 1.0, 0.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.9), 1.0, 0.0));

  d = min(d, sdCapsuleFixed(p, vec2(0.4, 0.0), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, 0.0), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(0.4, -0.9), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.9), 1.0, PI/2.0));
  return d;
}

float digit9(vec2 p) {
  float d = sdCapsuleFixed(p, vec2(-0.3, 0.7), 1.0, 0.0);
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, 0.0), 1.0, 0.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.9), 1.0, 0.0));

  d = min(d, sdCapsuleFixed(p, vec2(0.4, 0.0), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, 0.0), 1.0, PI/2.0));
  d = min(d, sdCapsuleFixed(p, vec2(-0.3, -0.9), 1.0, 0.0));
  return d;
}

vec2 gridOffset(float x, float y) {
  vec2 uv = vec2(x / 6.0, y / 5.0);
  uv = uv * 2.0 - 1.0;
  uv *= 10.0;
  uv.x = -uv.x;
  return uv;
}

void main() {
  vec2 uv = squareFrame(resolution.xy, gl_FragCoord.xy);

  
  float border = 0.35 * step(0.9, max(abs(uv.x), abs(uv.y)));
    
  if (MODE == MODE_GRID) {
    float d = 999999.0;
    uv *= 5.0;
    // Letters A-Z
    // d = min(d, letterA(uv + gridOffset(0, 0)));
    // d = min(d, letterB(uv + gridOffset(1, 0)));
    // d = min(d, letterC(uv + gridOffset(2, 0)));
    // d = min(d, letterD(uv + gridOffset(3, 0)));
    // d = min(d, letterE(uv + gridOffset(4, 0)));
    // d = min(d, letterF(uv + gridOffset(5, 0)));
    // d = min(d, letterG(uv + gridOffset(0, 1)));
    // d = min(d, letterH(uv + gridOffset(1, 1)));
    // d = min(d, letterI(uv + gridOffset(2, 1)));
    // d = min(d, letterJ(uv + gridOffset(3, 1)));
    // d = min(d, letterK(uv + gridOffset(4, 1)));
    // d = min(d, letterL(uv + gridOffset(5, 1)));
    // d = min(d, letterM(uv + gridOffset(0, 2)));
    // d = min(d, letterN(uv + gridOffset(1, 2)));
    // d = min(d, letterO(uv + gridOffset(2, 2)));
    // d = min(d, letterP(uv + gridOffset(3, 2)));
    // d = min(d, letterQ(uv + gridOffset(4, 2)));
    // d = min(d, letterR(uv + gridOffset(5, 2)));
    // d = min(d, letterS(uv + gridOffset(0, 3)));
    // d = min(d, letterT(uv + gridOffset(1, 3)));
    // d = min(d, letterU(uv + gridOffset(2, 3)));
    // d = min(d, letterV(uv + gridOffset(3, 3)));
    // d = min(d, letterW(uv + gridOffset(4, 3)));
    // d = min(d, letterX(uv + gridOffset(5, 3)));
    // d = min(d, letterY(uv + gridOffset(0, 4)));
    // d = min(d, letterZ(uv + gridOffset(1, 4)));
    
    // // Numbers 0-9
    // d = min(d, digit0(uv + gridOffset(2, 4)));
    // d = min(d, digit1(uv + gridOffset(3, 4)));
    // d = min(d, digit2(uv + gridOffset(4, 4)));
    // d = min(d, digit3(uv + gridOffset(5, 4)));
    // d = min(d, digit4(uv + gridOffset(0, 5)));
    // d = min(d, digit5(uv + gridOffset(1, 5)));
    // d = min(d, digit6(uv + gridOffset(2, 5)));
    // d = min(d, digit7(uv + gridOffset(3, 5)));
    // d = min(d, digit8(uv + gridOffset(4, 5)));
    // d = min(d, digit9(uv + gridOffset(5, 5)));
    // Spell JS13K, move the grid offset randomly based on time
    // d = min(d, digit1(uv + 0.5*sin(2.0*vec2(iTime,-iTime)) + gridOffset(1.7, 2.5)));
    // d = min(d, digit2(uv + 0.3*cos(3.0*vec2(iTime)) + gridOffset(2.4, 2.5)));
    d = min(d, digit0(uv + gridOffset(1.2, 2.5)));
    d = min(d, digit1(uv + gridOffset(1.7, 2.5)));
    d = min(d, digit2(uv + gridOffset(2.2, 2.5)));
    d = min(d, digit3(uv + gridOffset(2.7, 2.5)));
    d = min(d, digit4(uv + gridOffset(3.2, 2.5)));
    d = min(d, digit5(uv + gridOffset(3.7, 2.5)));
    d = min(d, digit6(uv + gridOffset(4.2, 2.5)));
    d = min(d, digit7(uv + gridOffset(4.7, 2.5)));
    d = min(d, digit8(uv + gridOffset(5.2, 2.5)));
    d = min(d, digit9(uv + gridOffset(5.7, 2.5)));
    //fragColor.rgb = vec3(1.0 - aastep(0.0, d) + border);
    fragColor.rgb = vec3(d);

  }
  fragColor.a = 1.0;
}