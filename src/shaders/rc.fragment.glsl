@nomangle texelFetch textureLod
#version 300 es
    #ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_resolution;
uniform sampler2D u_distanceTexture;
uniform sampler2D u_lastTexture;
uniform vec2 u_cascadeExtent; 
uniform float u_cascadeCount;
uniform float u_cascadeIndex;
uniform float u_basePixelsBetweenProbes;
uniform float u_cascadeInterval;
uniform float u_rayInterval;
uniform bool u_addNoise;
uniform bool u_enableSun;
uniform float u_sunAngle;
uniform float u_srgb;
uniform float u_firstCascadeIndex;
uniform float u_lastCascadeIndex;
uniform float u_baseRayCount;
uniform float u_time;

in vec2 vUv;
out vec4 FragColor;

const float PI = 3.14159265;
const float TAU = 2.0 * PI;
const float goldenAngle = PI * 0.7639320225;
const float sunDistance = 1.0;

const vec3 skyColor = vec3(0.2, 0.24, 0.35) * 6.0;
const vec3 sunColor = vec3(0.95, 0.9, 0.8) * 4.0;

const vec3 oldSkyColor = vec3(0.02, 0.08, 0.2);
const vec3 oldSunColor = vec3(0.95, 0.95, 0.9);

#define BRANCHING_FACTOR 2 // 2 
#define SPATIAL_SCALE_FACTOR 1 // 1

vec3 oldSunAndSky(float rayAngle) {
  // Get the sun / ray relative angle
  float angleToSun = mod(rayAngle - u_sunAngle, TAU);

  // Sun falloff based on the angle
  float sunIntensity = smoothstep(1.0, 0.0, angleToSun);

  // And that's our sky radiance
  return oldSunColor * sunIntensity + oldSkyColor;
}

vec3 sunAndSky(float rayAngle) {
    // Get the sun / ray relative angle
    float angleToSun = mod(rayAngle - u_sunAngle, TAU);

    // Sun falloff
    float sunIntensity = pow(max(0.0, cos(angleToSun)), 4.0 / sunDistance);

    return mix(sunColor * sunIntensity, skyColor, 0.3);
}

float rand(vec2 co) {
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

vec4 raymarch(
  vec2 normalizedPoint, vec2 delta, float scale, vec2 oneOverSize, vec2 interval, float intervalLength, float minStepSize
) {

    vec2 rayUv = normalizedPoint + delta * interval;

    if (floor(rayUv) != vec2(0.0)) return vec4(0);

    vec2 pre = delta * scale * oneOverSize;

    int safety = 0;

    for (float dist = 0.0; dist < intervalLength && safety < 100; safety++) {
        ivec2 texel = ivec2(int(rayUv.x * u_resolution.x), int(rayUv.y * u_resolution.y));
        float df = texelFetch(u_distanceTexture, texel, 0).r;

        df = df / max(u_resolution.x, u_resolution.y); // !!!
        if (df <= minStepSize) {
          ivec2 texel = ivec2(int(rayUv.x * u_resolution.x), int(rayUv.y * u_resolution.y));
          vec4 color = texelFetch(u_distanceTexture, texel, 0);
          color.rgb = pow(color.gba, vec3(u_srgb));
          color.a = 1.0;
          return color;
        }

        dist += df * scale;
        if (dist >= intervalLength) break;

        rayUv += pre * df;
        if (floor(rayUv) != vec2(0.0)) break;
    }

    return vec4(0);
}

vec4 merge(vec4 currentRadiance, float index, vec2 position, float spacingBase) {
    // Early return conditions
    if (currentRadiance.a > 0.0 || u_cascadeIndex >= u_cascadeCount - 1.0) {
      return currentRadiance;
    }
  
    float upperSpacing = pow(spacingBase, u_cascadeIndex + 1.0);
    vec2 upperSize = floor(u_cascadeExtent / upperSpacing);
    vec2 upperPosition = vec2(
      mod(index, upperSpacing),
      floor(index / upperSpacing)
    ) * upperSize;
  
    // Calculate the position within the upper cascade cell
    vec2 offset = (position + 0.5) / spacingBase;
  
    vec2 clamped = clamp(offset, vec2(1.0), upperSize - 1.0);
    vec2 upperProbePosition = (upperPosition + clamped) / u_cascadeExtent;
  
    // Sample from the next cascade
    vec4 upperSample = textureLod(
      u_lastTexture, upperProbePosition,
      u_basePixelsBetweenProbes == 1.0 ? 0.0 : log(u_basePixelsBetweenProbes) / log(2.0)
    );
  
    return currentRadiance + upperSample;
  }
  
  // Converts a color from linear light gamma to sRGB gamma
vec3 fromLinear(vec3 linearRGB)
{
    bvec3 cutoff = lessThan(linearRGB, vec3(0.0031308));
    vec3 higher = vec3(1.055)*pow(linearRGB, vec3(1.0/2.4)) - vec3(0.055);
    vec3 lower = linearRGB * vec3(12.92);

    return mix(higher, lower, cutoff);
}

  void main() {
      vec2 coord = floor(vUv * u_cascadeExtent);
  
    //   FragColor = vec4(0.5, 1.0, 1.0, 1.0);
    //   return;

      if (u_cascadeIndex == 0.0) {
        ivec2 texel = ivec2(int(vUv.x * u_resolution.x), int(vUv.y * u_resolution.y));
        vec4 color = texelFetch(u_distanceTexture, texel, 0); // sceneTexture !!!
        if (color.r < 2.0) {
            FragColor = vec4(color.gba, 1.0);
            // FragColor = vec4(color.r, 0.0, 1.0, 1.0);
            // FragColor = color.rgba;
            return;
        }
      }
  
      float base = u_baseRayCount;
      float rayCount = pow(base, u_cascadeIndex + 1.0);
      float sqrtBase = sqrt(base);
      float spacing = pow(sqrtBase, u_cascadeIndex);
  
      // Hand-wavy rule that improved smoothing of other base ray counts
      float modifierHack = base < 16.0 ? pow(u_basePixelsBetweenProbes, 1.0) : sqrtBase;
  
      vec2 size = floor(u_cascadeExtent / spacing);
      vec2 probeRelativePosition = mod(coord, size);
      vec2 rayPos = floor(coord / size);

      float rayInterval = u_rayInterval;
      float modifiedInterval = modifierHack * rayInterval * u_cascadeInterval;
  
      float start = u_cascadeIndex == 0.0 ? u_cascadeInterval : modifiedInterval;
      vec2 interval = (start * pow(base, (u_cascadeIndex - 1.0))) / u_resolution;
      float intervalLength = ((modifiedInterval) * pow(base, u_cascadeIndex));
  
      vec2 probeCenter = (probeRelativePosition + 0.5) * u_basePixelsBetweenProbes * spacing;
  
      float preAvgAmt = base;
  
      // Calculate which set of rays we care about
      float baseIndex = (rayPos.x + (spacing * rayPos.y)) * preAvgAmt;
      // The angle delta (how much it changes per index / ray)
      float angleStep = TAU / rayCount;
  
      // Can we do this instead of length?
      float scale = min(u_resolution.x, u_resolution.y);

      vec2 oneOverSize = 1.0 / u_resolution;
      float minStepSize = min(oneOverSize.x, oneOverSize.y) * 0.5;
      float avgRecip = 1.0 / (preAvgAmt);
  
      vec2 normalizedProbeCenter = probeCenter * oneOverSize;
     
      vec4 totalRadiance = vec4(0.0);
      float noise = u_addNoise
          ? rand(vUv * (u_cascadeIndex + 1.0))
          : 0.0;
  
      for (int i = 0; i < int(preAvgAmt); i++) {
        float index = baseIndex + float(i);
        float angle = (index + 0.5 + noise) * angleStep;
        vec2 rayDir = vec2(cos(angle), -sin(angle));
  
        // Core raymarching!
        vec4 raymarched = raymarch(
          normalizedProbeCenter, rayDir, scale, oneOverSize, interval, intervalLength, minStepSize
        );
  
        // Merge with the previous layer
        vec4 merged = merge(raymarched, index, probeRelativePosition, sqrtBase);
  
        // If enabled, apply the sky radiance
        if (u_enableSun && u_cascadeIndex == u_cascadeCount - 1.0) {
          merged.rgb = max(u_addNoise ? oldSunAndSky(angle) : sunAndSky(angle), merged.rgb);
        }
  
        totalRadiance += merged * avgRecip;
      }
  
      // FragColor = vec4(
      //   (u_cascadeIndex > u_firstCascadeIndex)
      //     ? totalRadiance.rgb
      //     : pow(totalRadiance.rgb, vec3(1.0 / u_srgb)),
      //   totalRadiance.a
      // );

      FragColor = vec4(
        (u_cascadeIndex > u_firstCascadeIndex)
          ? totalRadiance.rgb
          : fromLinear(totalRadiance.rgb),
        totalRadiance.a
      );
      
    }