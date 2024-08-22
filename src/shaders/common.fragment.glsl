@nomangle MERGE_FIX C_MINUS1_GATHERING BRANCHING_FACTOR SPATIAL_SCALE_FACTOR probe_center uintBitsToFloat texture
#define MERGE_FIX 4
#define C_MINUS1_GATHERING 1
// Number of cascades all together
const int nCascades = 6; // 6

// Brush radius used for drawing, measured as fraction of resolution.y
const float brushRadius = 0.02;

const float MAX_FLOAT = uintBitsToFloat(0x7f7fffffu);
const float PI = 3.1415927;
const float MAGIC = 1e25;

#define probe_center vec2(0.5f)

#define BRANCHING_FACTOR 2 // 2 
#define SPATIAL_SCALE_FACTOR 1 // 1

struct CascadeSize
{
    ivec2 probes_count;
    int dirs_count;
};

CascadeSize GetC0Size(ivec2 viewport_size)
{
    CascadeSize c0_size;
    #if BRANCHING_FACTOR == 0
        c0_size.probes_count = ivec2(256) * ivec2(1, viewport_size.y) / ivec2(1, viewport_size.x);//viewport_size / 10;
        c0_size.dirs_count = 64;
    #elif BRANCHING_FACTOR == 1
        c0_size.probes_count = ivec2(256) * ivec2(1, viewport_size.y) / ivec2(1, viewport_size.x);//viewport_size / 10;
        c0_size.dirs_count = 32;
    #elif BRANCHING_FACTOR == 2
        c0_size.probes_count = ivec2(512) * ivec2(1, viewport_size.y) / ivec2(1, viewport_size.x);//viewport_size / 10;
        c0_size.dirs_count = 4;
    #endif
    return c0_size;
}

float GetC0IntervalLength(ivec2 viewport_size)
{
    #if BRANCHING_FACTOR == 0
        return float(viewport_size.x) * 10.0f * 1e-2f;
    #elif BRANCHING_FACTOR == 1
        return float(viewport_size.x) * 15.0f * 1e-3f;
    #elif BRANCHING_FACTOR == 2
        return float(viewport_size.x) * 1.5f * 1e-3f;
    #endif
}

vec2 screenRes;

vec4 cubemapFetch(samplerCube sampler, int face, ivec2 P) {
    // Look up a single texel in a cubemap
    ivec2 cubemapRes = textureSize(sampler, 0);
    if (clamp(P, ivec2(0), cubemapRes - 1) != P || face < 0 || face > 5) {
        return vec4(0.0);
    }

    vec2 p = (vec2(P) + 0.5) / vec2(cubemapRes) * 2.0 - 1.0;
    vec3 c = vec3(0.0);
    
    // switch (face) {
    // case 0: c = vec3( 1.0, -p.y, -p.x); break;
    // case 1: c = vec3(-1.0, -p.y,  p.x); break;
    // case 2: c = vec3( p.x,  1.0,  p.y); break;
    // case 3: c = vec3( p.x, -1.0, -p.y); break;
    // case 4: c = vec3( p.x, -p.y,  1.0); break;
    // case 5: c = vec3(-p.x, -p.y, -1.0); break;
    // }
    if (face == 0) {
        c = vec3( 1.0, -p.y, -p.x);
    } else if (face == 1) {
        c = vec3(-1.0, -p.y,  p.x);
    } else if (face == 2) {
        c = vec3( p.x,  1.0,  p.y);
    } else if (face == 3) {
        c = vec3( p.x, -1.0, -p.y);
    } else if (face == 4) {
        c = vec3( p.x, -p.y,  1.0);
    } else if (face == 5) {
        c = vec3(-p.x, -p.y, -1.0);
    }
    
    return texture(sampler, normalize(c));
}

ivec2 roundSDim(ivec2 v) {
    return v - (v & ivec2((1 << nCascades) - 1));
}

float GetCascadeIntervalStartScale(int cascade_index)
{
    #if BRANCHING_FACTOR == 0
        return float(cascade_index);
    #else
        return (cascade_index == 0 ? 0.0f : float(1 << (BRANCHING_FACTOR * cascade_index))) + float(C_MINUS1_GATHERING);
    #endif
}

vec2 GetCascadeIntervalScale(int cascade_index)
{
    return vec2(GetCascadeIntervalStartScale(cascade_index), GetCascadeIntervalStartScale(cascade_index + 1));
}

struct BilinearSamples
{
    ivec2 base_index;
    vec2 ratio;
};

vec4 GetBilinearWeights(vec2 ratio)
{
    return vec4(
        (1.0f - ratio.x) * (1.0f - ratio.y),
        ratio.x * (1.0f - ratio.y),
        (1.0f - ratio.x) * ratio.y,
        ratio.x * ratio.y);
}

ivec2 GetBilinearOffset(int offset_index)
{
    ivec2 offsets[4] = ivec2[4](ivec2(0, 0), ivec2(1, 0), ivec2(0, 1), ivec2(1, 1));
    return offsets[offset_index];
}
BilinearSamples GetBilinearSamples(vec2 pixel_index2f)
{
    BilinearSamples samples;
    samples.base_index = ivec2(floor(pixel_index2f));
    samples.ratio = fract(pixel_index2f);
    return samples;
}

struct LinearSamples
{
    int base_index;
    float ratio;
};
vec2 GetLinearWeights(float ratio)
{
    return vec2(1.0f - ratio, ratio);
}
LinearSamples GetLinearSamples(float indexf)
{
    LinearSamples samples;
    samples.base_index = int(floor(indexf));
    samples.ratio = fract(indexf);
    return samples;
}

CascadeSize GetCascadeSize(int cascade_index, CascadeSize c0_size)
{
    CascadeSize cascade_size;
    cascade_size.probes_count = max(ivec2(1), c0_size.probes_count >> (SPATIAL_SCALE_FACTOR * cascade_index));
    cascade_size.dirs_count = c0_size.dirs_count * (1 << (BRANCHING_FACTOR * cascade_index));
    return cascade_size;
}

int GetCascadeLinearOffset(int cascade_index, CascadeSize c0_size)
{
    int c0_pixels_count = c0_size.probes_count.x * c0_size.probes_count.y * c0_size.dirs_count;
    int offset = 0;
    
    for(int i = 0; i < cascade_index; i++)
    {
        CascadeSize cascade_size = GetCascadeSize(i, c0_size);
        offset += cascade_size.probes_count.x * cascade_size.probes_count.y * cascade_size.dirs_count;
    }
    return offset;
    /*#if BRANCHING_FACTOR == 2
        return c0_pixels_count * cascade_index;
    #elif BRANCHING_FACTOR == 1
        return cascade_index == 0 ? 0 : (c0_pixels_count * ((1 << cascade_index) - 1) / (1 << (cascade_index - 1)));
    #endif*/
    
}



struct ProbeLocation
{
    ivec2 probe_index;
    int dir_index;
    int cascade_index;
};
int ProbeLocationToPixelIndex(ProbeLocation probe_location, CascadeSize c0_size)
{
    CascadeSize cascade_size = GetCascadeSize(probe_location.cascade_index, c0_size);
    int probe_linear_index = probe_location.probe_index.x + probe_location.probe_index.y * cascade_size.probes_count.x;
    int offset_in_cascade = probe_linear_index * cascade_size.dirs_count + probe_location.dir_index;
    return GetCascadeLinearOffset(probe_location.cascade_index, c0_size) + offset_in_cascade ;
}

ProbeLocation PixelIndexToProbeLocation(int pixel_index, CascadeSize c0_size)
{
    ProbeLocation probe_location;

    for(
        probe_location.cascade_index = 0;
        GetCascadeLinearOffset(probe_location.cascade_index + 1, c0_size) <= pixel_index && probe_location.cascade_index < 10;
        probe_location.cascade_index++);

    int offset_in_cascade = pixel_index - GetCascadeLinearOffset(probe_location.cascade_index, c0_size);
    CascadeSize cascade_size = GetCascadeSize(probe_location.cascade_index, c0_size);
    
    probe_location.dir_index = offset_in_cascade % cascade_size.dirs_count;
    int probe_linear_index = offset_in_cascade / cascade_size.dirs_count;
    probe_location.probe_index = ivec2(probe_linear_index % cascade_size.probes_count.x, probe_linear_index / cascade_size.probes_count.x);
    return probe_location;
}
ivec3 PixelIndexToCubemapTexel(ivec2 face_size, int pixel_index)
{
    int face_pixels_count = face_size.x * face_size.y;
    int face_index = pixel_index / face_pixels_count;
    int face_pixel_index = pixel_index - face_pixels_count * face_index;
    ivec2 face_pixel = ivec2(face_pixel_index % face_size.x, face_pixel_index / face_size.x);
    return ivec3(face_pixel, face_index);
}

vec2 GetProbeScreenSize(int cascade_index, CascadeSize c0_size)
{
    vec2 c0_probe_screen_size = vec2(1.0f) / vec2(c0_size.probes_count);
    return c0_probe_screen_size * float(1 << (SPATIAL_SCALE_FACTOR * cascade_index));
}

BilinearSamples GetProbeBilinearSamples(vec2 screen_pos, int cascade_index, CascadeSize c0_size)
{
    vec2 probe_screen_size = GetProbeScreenSize(cascade_index, c0_size);
    
    vec2 prev_probe_index2f = screen_pos / probe_screen_size - probe_center;    
    return GetBilinearSamples(prev_probe_index2f);
}

vec2 GetProbeScreenPos(vec2 probe_index2f, int cascade_index, CascadeSize c0_size)
{
    vec2 probe_screen_size = GetProbeScreenSize(cascade_index, c0_size);
    
    return (probe_index2f + probe_center) * probe_screen_size;
}

vec2 GetProbeDir(float dir_indexf, int dirs_count)
{
    float ang_ratio = (dir_indexf + 0.5f) / float(dirs_count);
    float ang = ang_ratio * 2.0f * PI;
    return vec2(cos(ang), sin(ang));
}

float GetDirIndexf(vec2 dir, int dirs_count)
{
    float ang = atan(dir.y, dir.x);
    float ang_ratio = ang / (2.0f * PI);
    return ang_ratio * float(dirs_count) - 0.5f;
}

vec4 MergeIntervals(vec4 near_interval, vec4 far_interval)
{
    //return near_interval + far_interval;
    return vec4(near_interval.rgb + near_interval.a * far_interval.rgb, near_interval.a * far_interval.a);
}

const int KEY_SPACE = 32;
const int KEY_1 = 49;

#ifndef HW_PERFORMANCE
// uniform vec4 iMouse;
// uniform sampler2D iChannel2;
uniform float iTime;
#endif

bool keyToggled(int keyCode) {
    return false;
    // return texelFetch(iChannel2, ivec2(keyCode, 2), 0).r > 0.0;
}

vec3 hsv2rgb(vec3 c) {
    vec3 rgb = clamp(
        abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0,
        0.0,
        1.0
    );
	return c.z * mix(vec3(1.0), rgb, c.y);
}

vec3 getEmissivity() {
    return !keyToggled(KEY_SPACE)
        ? pow(hsv2rgb(vec3(iTime * 0.2 + 0.0f, 1.0, 2.5)), vec3(2.2))
        : vec3(0.0);
}



vec4 sampleDrawing(sampler2D drawingTex, vec2 P) {
    // Return the drawing (in the format listed at the top of Buffer B) at P
    vec4 data = texture(drawingTex, P / vec2(textureSize(drawingTex, 0)));
    
    // if (keyToggled(KEY_1) && iMouse.z > 0.0) {
    //     float radius = brushRadius * screenRes.y;
    //     //float sd = sdCircle(P, iMouse.xy + 0.5, radius);
    //     float sd = sdSegment(P, abs(iMouse.zw) + 0.5, iMouse.xy + 0.5) - radius;
        
    //     if (sd <= max(data.r, 0.0)) {
    //         data = vec4(min(sd, data.r), getEmissivity());
    //     }
    // }

    return data;
}

float sdDrawing(sampler2D drawingTex, vec2 P) {
    // Return the signed distance for the drawing at P
    return sampleDrawing(drawingTex, P).r;
}

vec2 intersectAABB(vec2 ro, vec2 rd, vec2 a, vec2 b) {
    // Return the two intersection t-values for the intersection between a ray
    // and an axis-aligned bounding box
    vec2 ta = (a - ro) / rd;
    vec2 tb = (b - ro) / rd;
    vec2 t1 = min(ta, tb);
    vec2 t2 = max(ta, tb);
    vec2 t = vec2(max(t1.x, t1.y), min(t2.x, t2.y));
    return t.x > t.y ? vec2(-1.0) : t;
}



float intersect(sampler2D sdf_tex, vec2 ro, vec2 rd, float tMax) {
    // Return the intersection t-value for the intersection between a ray and
    // the SDF drawing from Buffer B
    screenRes = vec2(textureSize(sdf_tex, 0));
    float tOffset = 0.0;
    // First clip the ray to the screen rectangle
    vec2 tAABB = intersectAABB(ro, rd, vec2(0.0001), screenRes - 0.0001);
    
    if (tAABB.x > tMax || tAABB.y < 0.0) {
        return -1.0;
    }
    
    if (tAABB.x > 0.0) {
        ro += tAABB.x * rd;
        tOffset += tAABB.x;
        tMax -= tAABB.x;
    }
    
    if (tAABB.y < tMax) {
        tMax = tAABB.y;
    }

    float t = 0.0;

    for (int i = 0; i < 100; i++) {
        float d = sdDrawing(sdf_tex, ro + rd * t);
        
        t += (d);
        if ((d) < 0.01)
            return t;

        if (t >= tMax) {
            break;
        }
    }

    return -1.0;
}

struct RayHit
{
    vec4 radiance;
    float dist;
};
#if MERGE_FIX != 3 //Dolkar fix works better if miss rays terminate instead of being infinite
RayHit radiance(sampler2D sdf_tex, vec2 ro, vec2 rd, float tMax) {
    // Returns the radiance and visibility term for a ray
    vec4 p = sampleDrawing(sdf_tex, ro);
    float t = 1e6f;
    if (p.r > 0.0) {
        t = intersect(sdf_tex, ro, rd, tMax);
        
        if (t == -1.0) {
            return RayHit(vec4(0.0, 0.0, 0.0, 1.0), 1e5f);
        }

        p = sampleDrawing(sdf_tex, ro + rd * t);
    }

    return RayHit(vec4(p.gba, 0.0), t);
}
#else
RayHit radiance(sampler2D sdf_tex, vec2 ro, vec2 rd, float tMax) {
    // Returns the radiance and visibility term for a ray
    vec4 p = sampleDrawing(sdf_tex, ro);
    if (p.r > 0.0) {
        float t = intersect(sdf_tex, ro, rd, tMax);
        
        if (t == -1.0) {
            return RayHit(vec4(0.0, 0.0, 0.0, 1.0), 1e5f);
        }

        p = sampleDrawing(sdf_tex, ro + rd * t);
        return RayHit(vec4(p.gba, 0.0), t);
    } else {
        return RayHit(vec4(0.0), 0.0);
    }
}
#endif