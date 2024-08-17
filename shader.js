const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2');

let mFloat32Textures;
let mFloat32Filter;
let mFloat16Textures;
let mDrawBuffers;
let mDepthTextures;
let mDerivatives;
let mFloat16Filter;
let mShaderTextureLOD;
let mAnisotropic;
let mRenderToFloat32F;
let mDebugShader;
let mAsynchCompile;
mFloat32Textures  = true;
mFloat32Filter    = gl.getExtension( 'OES_texture_float_linear');
mFloat16Textures  = true;
mFloat16Filter    = gl.getExtension( 'OES_texture_half_float_linear' );
mDerivatives      = true;
mDrawBuffers      = true;
mDepthTextures    = true;
mShaderTextureLOD = true;
mAnisotropic = gl.getExtension( 'EXT_texture_filter_anisotropic' );
mRenderToFloat32F = gl.getExtension( 'EXT_color_buffer_float');
mDebugShader = gl.getExtension('WEBGL_debug_shaders');
mAsynchCompile = gl.getExtension('KHR_parallel_shader_compile');

// Set the canvas size
canvas.width = window.innerWidth;  // Set canvas width to window width
canvas.height = window.innerHeight;  // Set canvas height to window height

const mGl = {
  TEXTURE_2D: 0,
  TEXTURE_CUBE_MAP: 1,
}

const CUBEMAP_RES = 1024;

const cubemapBuffer = {
    textures: [null, null], // 2 elements
    targets: [null, null], // 2 elements
    lastRenderDone: 0
  }

const bufferA = {
    textures: [null, null], // 2 elements
    targets: [null, null], // 2 elements
    lastRenderDone: 0
}

const bufferB = {
    textures: [null, null], // 2 elements
    targets: [null, null], // 2 elements
    lastRenderDone: 0
}

resizeBuffer(gl, bufferA);
resizeBuffer(gl, bufferB);
resizeCubemapBuffer(gl, cubemapBuffer);


function resizeCanvas() {
  // Set the canvas size to match the new window size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Recreate the textures for each framebuffer
  resizeBuffer(gl, bufferA);
  resizeBuffer(gl, bufferB);
  // Cubemap is fixed size
  // resizeCubemapBuffer(gl, cubemapBuffer);

  // Update the WebGL viewport to match the new canvas size
  gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener('resize', resizeCanvas);

function resizeBuffer(gl, fbObj) {
  const width = gl.canvas.width;
  const height = gl.canvas.height;

  // Resize textures[1] and [2] to match the new canvas size
  let texture1 = createTexture(gl, width, height);
  let texture2 = createTexture(gl, width, height);

  let target1 = createRenderTarget(texture1);
  let target2 = createRenderTarget(texture2);


  // // Destroy the old textures ???
  // gl.deleteTexture(fbObj.textures[0]);
  // gl.deleteTexture(fbObj.textures[1]);
  // // Destroy the old render targets
  // gl.deleteFramebuffer(fbObj.targets[0]);
  // gl.deleteFramebuffer(fbObj.targets[1]);

  
  fbObj.textures = [texture1, texture2];
  fbObj.targets = [target1, target2];  
}

function resizeCubemapBuffer(gl, fbObj) {
  const width = CUBEMAP_RES;
  const height = CUBEMAP_RES;

  // Resize textures[1] and [2] to match the new canvas size
  let texture1 = createTexture(gl, width, height, mGl.TEXTURE_CUBE_MAP);
  let texture2 = createTexture(gl, width, height, mGl.TEXTURE_CUBE_MAP);

  let target1 = createRenderTargetCubemap(texture1);
  let target2 = createRenderTargetCubemap(texture2);

  fbObj.textures = [texture1, texture2];
  fbObj.targets = [target1, target2];
}


function createTexture(gl, width, height, type = mGl.TEXTURE_2D) {
  const texture = gl.createTexture();
  if(type == mGl.TEXTURE_2D) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  } else if(type == mGl.TEXTURE_CUBE_MAP) {
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    width = 1024 // fixed 
    height = 1024 // fixed
    // This translates to:
    // mGL.texImage2D( mGL.TEXTURE_CUBE_MAP_POSITIVE_X, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer );
    // mGL.texImage2D( mGL.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer );
    // mGL.texImage2D( mGL.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer );
    // mGL.texImage2D( mGL.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer );
    // mGL.texImage2D( mGL.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer );
    // mGL.texImage2D( mGL.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer );
    for (let i = 0; i < 6; i++) {
      gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
  }
  return texture;
}

const commonShaderSrc = `
float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

#define MERGE_FIX 1
#define C_MINUS1_GATHERING 1
// Number of cascades all together
const int nCascades = 6;

// Brush radius used for drawing, measured as fraction of resolution.y
const float brushRadius = 0.02;

const float MAX_FLOAT = uintBitsToFloat(0x7f7fffffu);
const float PI = 3.1415927;
const float MAGIC = 1e25;

#define probe_center vec2(0.5f)

#define BRANCHING_FACTOR 2
#define SPATIAL_SCALE_FACTOR 2

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
    vec3 c;
    
    switch (face) {
        case 0: c = vec3( 1.0, -p.y, -p.x); break;
        case 1: c = vec3(-1.0, -p.y,  p.x); break;
        case 2: c = vec3( p.x,  1.0,  p.y); break;
        case 3: c = vec3( p.x, -1.0, -p.y); break;
        case 4: c = vec3( p.x, -p.y,  1.0); break;
        case 5: c = vec3(-p.x, -p.y, -1.0); break;
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
uniform vec4 iMouse;
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

float sdCircle(vec2 p, vec2 c, float r) {
    return distance(p, c) - r;
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 ap = p - a;
    vec2 ab = b - a;
    return distance(ap, ab * clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0));
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
`;

const bufferAShaderSrc = `#version 300 es
precision highp float;
uniform sampler2D iChannel0;
uniform vec2 resolution;  
out vec4 fragColor;
${commonShaderSrc}
void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 color = texture(iChannel0, uv);
    // Buffer A logic
    fragColor = color;
}
`;

const bufferBShaderSrc = `#version 300 es
precision highp float;
uniform sampler2D iChannel0;  // Input from Common
uniform vec2 resolution;  
out vec4 fragColor;
${commonShaderSrc} 

float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

void main() {
#define GRID_WIDTH 5
#define GRID_HEIGHT 5
#define NUM_CAPSULES (GRID_WIDTH * GRID_HEIGHT)

// Calculate the center of the screen
vec2 center = resolution.xy * 0.5;

// Position of the current fragment relative to the center
vec2 p = gl_FragCoord.xy - center;

// Time-dependent parameters
float time = iTime;

// Arrays to store individual capsule properties
vec2 positions[NUM_CAPSULES];
float rotations[NUM_CAPSULES];
vec3 colors[NUM_CAPSULES];
float lengths[NUM_CAPSULES];
float radii[NUM_CAPSULES];

// Initialize capsule properties
float gridSpacingX = resolution.x * 0.8 / float(GRID_WIDTH);
float gridSpacingY = resolution.y * 0.8 / float(GRID_HEIGHT);
vec2 gridOffset = vec2(-gridSpacingX * float(GRID_WIDTH - 1) * 0.5,
                       -gridSpacingY * float(GRID_HEIGHT - 1) * 0.5);

for (int y = 0; y < GRID_HEIGHT; y++) {
    for (int x = 0; x < GRID_WIDTH; x++) {
        int i = y * GRID_WIDTH + x;
        positions[i] = gridOffset + vec2(float(x) * gridSpacingX, float(y) * gridSpacingY);
        rotations[i] = time * (.0 + float(i) * 0.2);
        colors[i] = vec3(0.5 + 0.5 * sin(time + 4.0*float(i)),
                         0.5 + 0.5 * cos(time * 1.5 + float(i)),
                         0.5 + 0.5 * sin(time * 2.0 + float(i)));

        // Every 3rd capsule is black, without a conditional
        colors[i] = mix(colors[i], vec3(0.0), float(i % 3 == 0));
        
        lengths[i] = 60.0 + 20.0 * sin(time * 0.5 + float(i));
        radii[i] = 20.0 + 10.0 * cos(time * 0.7 + float(i));
    }
}

float minDist = 1e10;
vec3 finalColor = vec3(0.0);

for (int i = 0; i < NUM_CAPSULES; i++) {
    // Define the endpoints of the capsule in pixel space
    vec2 a = vec2(-lengths[i], 0.0);
    vec2 b = vec2(lengths[i], 0.0);

    // Rotate the capsule
    mat2 rotation = mat2(cos(rotations[i]), -sin(rotations[i]),
                         sin(rotations[i]), cos(rotations[i]));
    a = rotation * a;
    b = rotation * b;

    // Translate the capsule
    a += positions[i];
    b += positions[i];

    // Calculate the SDF of the capsule
    float sd = sdCapsule(p, a, b, radii[i]);

    // Update the minimum distance and color if this capsule is closer
    if (sd < minDist) {
        minDist = sd;
        finalColor = colors[i];
    }
}

// Output the final color
fragColor = vec4(minDist, finalColor);

//  // Calculate the center of the screen
  //   vec2 center = resolution.xy * 0.5;

  //   // Position of the current fragment relative to the center
  //   vec2 p = gl_FragCoord.xy - center;

  //   // Time-dependent parameters
  //   float time = iTime;
  //   float capsuleLength = 100.0 + 50.0 * sin(time * 0.5); // Varying length of the capsule in pixels
  //   float capsuleRadius = 50.0 + 25.0 * cos(time * 0.7);  // Varying radius of the capsule in pixels
  //   float rotationAngle = time * 6.0; // Rotation angle over time

  //   // Define the endpoints of the capsule in pixel space
  //   vec2 a = vec2(-capsuleLength, 0.0);
  //   vec2 b = vec2( capsuleLength, 0.0);

  //   // Rotate the capsule by the rotation angle
  //   mat2 rotation = mat2(cos(rotationAngle), -sin(rotationAngle),
  //                        sin(rotationAngle),  cos(rotationAngle));
  //   a = rotation * a;
  //   b = rotation * b;

  //   // Calculate the SDF of the capsule relative to the center
  //   float sd = sdCapsule(p, a, b, capsuleRadius);

  //   float sdCircle1 = sdCircle(p, vec2(-100.0, 0.0), 50.0);


  //   // Emissivity (color) changes over time, but each SDF is different
  //   vec3 emissivity = vec3(0.5 + 0.5 * sin(time * 2.0),
  //                          0.5 + 0.5 * cos(time * 1.5),
  //                          0.5 + 0.5 * sin(time * 1.0));
    
  //   vec3 colorCapsule = vec3(1.0, 0.5, 0.0); // Orange color for the capsule
  //   vec3 colorCircle = vec3(0.0, 0.5, 1.0);  // Blue color for the circle

  //   if (sd < sdCircle1) {
  //       fragColor = vec4(sd, colorCapsule);
  //   } else {  
  //       fragColor = vec4(sdCircle1, colorCircle);
  //   }
    

    // Combined SDF
    // float combinedSDF = min(sd, sdCircle1);

    // fragColor = vec4(combinedSDF, emissivity);
}

`;

const cubeAShaderSrc = `#version 300 es
precision highp float;
uniform samplerCube iChannel0;
uniform sampler2D iChannel1; 
uniform vec2 resolution;  
${commonShaderSrc}


// This buffer calculates and merges radiance cascades. Normally the
// merging would happen within one frame (like a mipmap calculation),
// meaning this technique actually has no termporal lag - but since
// Shadertoy has no way of running a pass multiple times per frame, we 
// have to resort to spreading out the merging of cascades over multiple
// frames.






vec3 integrateSkyRadiance_(vec2 angle) {
    // Sky radiance helper function
    float a1 = angle[1];
    float a0 = angle[0];
    
    // Sky integral formula taken from
    // Analytic Direct Illumination - Mathis
    // https://www.shadertoy.com/view/NttSW7
    const vec3 SkyColor = vec3(0.2,0.5,1.);
    const vec3 SunColor = vec3(1.,0.7,0.1)*10.;
    const float SunA = 2.0;
    const float SunS = 64.0;
    const float SSunS = sqrt(SunS);
    const float ISSunS = 1./SSunS;
    vec3 SI = SkyColor*(a1-a0-0.5*(cos(a1)-cos(a0)));
    SI += SunColor*(atan(SSunS*(SunA-a0))-atan(SSunS*(SunA-a1)))*ISSunS;
    return SI / 6.0;
}

vec3 integrateSkyRadiance(vec2 angle) {
    // Integrate the radiance from the sky over an interval of directions
    if (angle[1] < 2.0 * PI) {
        return integrateSkyRadiance_(angle);
    }
    
    return
        integrateSkyRadiance_(vec2(angle[0], 2.0 * PI)) +
        integrateSkyRadiance_(vec2(0.0, angle[1] - 2.0 * PI));
}

#define RAYS_FORK_POW 2


vec4 CastMergedInterval(vec2 screen_pos, vec2 dir, vec2 interval_length, int prev_cascade_index, int prev_dir_index)
{
    ivec2 face_size = textureSize(iChannel0, 0);    
    ivec2 viewport_size = textureSize(iChannel1, 0);
    CascadeSize c0_size = GetC0Size(viewport_size);
    CascadeSize prev_cascade_size = GetCascadeSize(prev_cascade_index, c0_size);

    vec2 ray_start = screen_pos * vec2(viewport_size) + dir * interval_length.x;
    vec2 ray_end = screen_pos * vec2(viewport_size) + dir * interval_length.y;                

    RayHit ray_hit = radiance(iChannel1, ray_start, normalize(ray_end - ray_start), length(ray_end - ray_start));

    BilinearSamples bilinear_samples = GetProbeBilinearSamples(screen_pos, prev_cascade_index, c0_size);
    vec4 weights = GetBilinearWeights(bilinear_samples.ratio);
    vec4 prev_interp_interval = vec4(0.0f);
    for(int i = 0; i < 4; i++)
    {
        ProbeLocation prev_probe_location;
        prev_probe_location.cascade_index = prev_cascade_index;
        prev_probe_location.probe_index = clamp(bilinear_samples.base_index + GetBilinearOffset(i), ivec2(0), prev_cascade_size.probes_count - ivec2(1));
        prev_probe_location.dir_index = prev_dir_index;


        int pixel_index = ProbeLocationToPixelIndex(prev_probe_location, c0_size);
        ivec3 texel_index = PixelIndexToCubemapTexel(face_size, pixel_index);

        vec4 prev_interval = vec4(0.0f, 0.0f, 0.0f, 1.0f);
        if(prev_cascade_index < nCascades)
            prev_interval = cubemapFetch(iChannel0, texel_index.z, texel_index.xy);

        prev_interp_interval += prev_interval * weights[i];
    }
    return MergeIntervals(ray_hit.radiance, prev_interp_interval);
}

vec4 InterpProbeDir(ivec2 probe_index, int cascade_index, float dir_indexf)
{
    ivec2 face_size = textureSize(iChannel0, 0);    
    ivec2 viewport_size = textureSize(iChannel1, 0);
    CascadeSize c0_size = GetC0Size(viewport_size);
    CascadeSize cascade_size = GetCascadeSize(cascade_index, c0_size);
    
    vec4 interp_interval = vec4(0.0f);
    LinearSamples dir_samples = GetLinearSamples(dir_indexf);
    vec2 weights = GetLinearWeights(dir_samples.ratio);
    for(int i = 0; i < 2; i++)
    {
        ProbeLocation probe_location;
        probe_location.cascade_index = cascade_index;
        probe_location.probe_index = probe_index;
        probe_location.dir_index = (dir_samples.base_index + i + cascade_size.dirs_count) % cascade_size.dirs_count;
        
        int pixel_index = ProbeLocationToPixelIndex(probe_location, c0_size);
        ivec3 texel_index = PixelIndexToCubemapTexel(face_size, pixel_index);
        
        vec4 prev_interval = cubemapFetch(iChannel0, texel_index.z, texel_index.xy);
        interp_interval += prev_interval * weights[i];
    }
    return interp_interval;
}

vec4 CastMergedIntervalParallaxFix(vec2 screen_pos, vec2 dir, vec2 interval_length, int prev_cascade_index, int prev_dir_index)
{
    ivec2 face_size = textureSize(iChannel0, 0);    
    ivec2 viewport_size = textureSize(iChannel1, 0);
    CascadeSize c0_size = GetC0Size(viewport_size);
    CascadeSize prev_cascade_size = GetCascadeSize(prev_cascade_index, c0_size);
    
    vec2 ray_start = screen_pos * vec2(viewport_size) + dir * interval_length.x;
    vec2 ray_end = screen_pos * vec2(viewport_size) + dir * interval_length.y;                

    RayHit ray_hit = radiance(iChannel1, ray_start, normalize(ray_end - ray_start), length(ray_end - ray_start));

    BilinearSamples bilinear_samples = GetProbeBilinearSamples(screen_pos, prev_cascade_index, c0_size);
    vec4 weights = GetBilinearWeights(bilinear_samples.ratio);
    vec4 prev_interp_interval = vec4(0.0f);
    for(int i = 0; i < 4; i++)
    {
        ivec2 prev_probe_index = clamp(bilinear_samples.base_index + GetBilinearOffset(i), ivec2(0), prev_cascade_size.probes_count - ivec2(1));
        vec2 prev_screen_pos = GetProbeScreenPos(vec2(prev_probe_index), prev_cascade_index, c0_size);
        float prev_dir_indexf = GetDirIndexf(ray_end - prev_screen_pos * vec2(viewport_size), prev_cascade_size.dirs_count);
        vec4 prev_interval = vec4(0.0f, 0.0f, 0.0f, 1.0f);
        if(prev_cascade_index < nCascades)
            prev_interval = InterpProbeDir(
                prev_probe_index,
                prev_cascade_index,
                prev_dir_indexf);

        prev_interp_interval += prev_interval * weights[i];
    }
    return MergeIntervals(ray_hit.radiance, prev_interp_interval);
}


vec4 CastMergedIntervalBilinearFix(vec2 screen_pos, vec2 dir, vec2 interval_length, int prev_cascade_index, int prev_dir_index)
{
    ivec2 face_size = textureSize(iChannel0, 0);    
    ivec2 viewport_size = textureSize(iChannel1, 0);
    CascadeSize c0_size = GetC0Size(viewport_size);
    CascadeSize prev_cascade_size = GetCascadeSize(prev_cascade_index, c0_size);
    
    BilinearSamples bilinear_samples = GetProbeBilinearSamples(screen_pos, prev_cascade_index, c0_size);
    vec4 weights = GetBilinearWeights(bilinear_samples.ratio);
    vec4 merged_interval = vec4(0.0f);
    for(int i = 0; i < 4; i++)
    {
        ProbeLocation prev_probe_location;
        prev_probe_location.cascade_index = prev_cascade_index;
        prev_probe_location.probe_index = clamp(bilinear_samples.base_index + GetBilinearOffset(i), ivec2(0), prev_cascade_size.probes_count - ivec2(1));
        prev_probe_location.dir_index = prev_dir_index;


        int pixel_index = ProbeLocationToPixelIndex(prev_probe_location, c0_size);
        ivec3 texel_index = PixelIndexToCubemapTexel(face_size, pixel_index);

        vec4 prev_interval = vec4(0.0f, 0.0f, 0.0f, 1.0f);
        if(prev_cascade_index < nCascades)
            prev_interval = cubemapFetch(iChannel0, texel_index.z, texel_index.xy);

        vec2 prev_screen_pos = GetProbeScreenPos(vec2(prev_probe_location.probe_index), prev_probe_location.cascade_index, c0_size);

        vec2 ray_start = screen_pos * vec2(viewport_size) + dir * interval_length.x;
        vec2 ray_end = prev_screen_pos * vec2(viewport_size) + dir * interval_length.y;                

        RayHit ray_hit = radiance(iChannel1, ray_start, normalize(ray_end - ray_start), length(ray_end - ray_start));
        merged_interval += MergeIntervals(ray_hit.radiance, prev_interval) * weights[i];
    }
    return merged_interval;
}


vec4 CastMergedIntervalMidpointBilinearFix(vec2 screen_pos, vec2 dir, vec2 interval_length, int prev_cascade_index, int prev_dir_index)
{

    ivec2 face_size = textureSize(iChannel0, 0);    
    ivec2 viewport_size = textureSize(iChannel1, 0);
    CascadeSize c0_size = GetC0Size(viewport_size);
    CascadeSize prev_cascade_size = GetCascadeSize(prev_cascade_index, c0_size);
    vec2 probe_screen_size = GetProbeScreenSize(prev_cascade_index, c0_size);

    float midpoint_length = max(interval_length.x, interval_length.y - probe_screen_size.x * float(viewport_size.x) * 1.5f);
    
    vec2 ray_start_1 = screen_pos * vec2(viewport_size) + dir * interval_length.x;
    vec2 ray_end_1 = screen_pos * vec2(viewport_size) + dir * midpoint_length;                

    RayHit ray_hit_1 = radiance(iChannel1, ray_start_1, normalize(ray_end_1 - ray_start_1), length(ray_end_1 - ray_start_1));

    
    BilinearSamples bilinear_samples = GetProbeBilinearSamples(screen_pos, prev_cascade_index, c0_size);
    vec4 weights = GetBilinearWeights(bilinear_samples.ratio);
    vec4 merged_interval = vec4(0.0f);
    for(int i = 0; i < 4; i++)
    {
        ProbeLocation prev_probe_location;
        prev_probe_location.cascade_index = prev_cascade_index;
        prev_probe_location.probe_index = clamp(bilinear_samples.base_index + GetBilinearOffset(i), ivec2(0), prev_cascade_size.probes_count - ivec2(1));
        prev_probe_location.dir_index = prev_dir_index;


        int pixel_index = ProbeLocationToPixelIndex(prev_probe_location, c0_size);
        ivec3 texel_index = PixelIndexToCubemapTexel(face_size, pixel_index);

        vec4 prev_interval = vec4(0.0f, 0.0f, 0.0f, 1.0f);
        if(prev_cascade_index < nCascades)
            prev_interval = cubemapFetch(iChannel0, texel_index.z, texel_index.xy);

        vec2 prev_screen_pos = GetProbeScreenPos(vec2(prev_probe_location.probe_index), prev_probe_location.cascade_index, c0_size);

        vec2 ray_start_2 = ray_end_1;
        vec2 ray_end_2 = prev_screen_pos * vec2(viewport_size) + dir * interval_length.y;                

        RayHit ray_hit_2 = radiance(iChannel1, ray_start_2, normalize(ray_end_2 - ray_start_2), length(ray_end_2 - ray_start_2));
        
        vec4 combined_interval = MergeIntervals(ray_hit_1.radiance, ray_hit_2.radiance);
        merged_interval += MergeIntervals(combined_interval, prev_interval) * weights[i];
    }
    return merged_interval;
}

vec4 CastMergedIntervalMaskFix(vec2 screen_pos, vec2 dir, vec2 interval_length, int prev_cascade_index, int prev_dir_index)
{

    ivec2 face_size = textureSize(iChannel0, 0);    
    ivec2 viewport_size = textureSize(iChannel1, 0);
    CascadeSize c0_size = GetC0Size(viewport_size);
    CascadeSize prev_cascade_size = GetCascadeSize(prev_cascade_index, c0_size);
    vec2 probe_screen_size = GetProbeScreenSize(prev_cascade_index, c0_size);

    vec2 ray_start = screen_pos * vec2(viewport_size) + dir * interval_length.x;
    vec2 ray_end = screen_pos * vec2(viewport_size) + dir * (interval_length.y + probe_screen_size.x * float(viewport_size.x) * 3.0f); 

    vec2 ray_dir = normalize(ray_end - ray_start);
    RayHit ray_hit = radiance(iChannel1, ray_start, ray_dir, length(ray_end - ray_start));

    BilinearSamples bilinear_samples = GetProbeBilinearSamples(screen_pos, prev_cascade_index, c0_size);
    vec4 weights = GetBilinearWeights(bilinear_samples.ratio);
    
    vec4 masks;
    for(int i = 0; i < 4; i++)
    {
        ivec2 prev_probe_index = clamp(bilinear_samples.base_index + GetBilinearOffset(i), ivec2(0), prev_cascade_size.probes_count - ivec2(1));
        vec2 prev_screen_pos = GetProbeScreenPos(vec2(prev_probe_index), prev_cascade_index, c0_size);
        
        float max_hit_dist = dot(prev_screen_pos * vec2(viewport_size) + ray_dir * interval_length.y - ray_start, ray_dir);
        masks[i] = ray_hit.dist > max_hit_dist ? 0.0f : 1.0f;
    }
    
    float interp_mask = dot(masks, weights);
    
    vec4 ray_interval = ray_hit.radiance;
    // https://www.desmos.com/calculator/2oxzmwlwhi
    ray_interval.a = 1.0 - (1.0 - ray_interval.a) * interp_mask;
    ray_interval.rgb *= 1.0 - ray_interval.a * (1.0 - interp_mask);
    
    vec4 prev_interp_interval = vec4(0.0f);
    for(int i = 0; i < 4; i++)
    {
        ProbeLocation prev_probe_location;
        prev_probe_location.cascade_index = prev_cascade_index;
        prev_probe_location.probe_index = clamp(bilinear_samples.base_index + GetBilinearOffset(i), ivec2(0), prev_cascade_size.probes_count - ivec2(1));
        prev_probe_location.dir_index = prev_dir_index;


        int pixel_index = ProbeLocationToPixelIndex(prev_probe_location, c0_size);
        ivec3 texel_index = PixelIndexToCubemapTexel(face_size, pixel_index);

        vec4 prev_interval = vec4(0.0f, 0.0f, 0.0f, 1.0f);
        if(prev_cascade_index < nCascades)
            prev_interval = cubemapFetch(iChannel0, texel_index.z, texel_index.xy);
        prev_interp_interval += prev_interval * weights[i];
    }
    return MergeIntervals(ray_interval, prev_interp_interval);
}

vec4 CastInterpProbeDir(ivec2 probe_index, int cascade_index, vec2 interval_length, float dir_indexf)
{
    ivec2 face_size = textureSize(iChannel0, 0);    
    ivec2 viewport_size = textureSize(iChannel1, 0);
    CascadeSize c0_size = GetC0Size(viewport_size);
    CascadeSize cascade_size = GetCascadeSize(cascade_index, c0_size);
    
    vec2 probe_screen_pos = GetProbeScreenPos(vec2(probe_index), cascade_index, c0_size);

    vec4 interp_interval = vec4(0.0f);
    LinearSamples dir_samples = GetLinearSamples(dir_indexf);
    vec2 weights = GetLinearWeights(dir_samples.ratio);
    for(int i = 0; i < 2; i++)
    {
        int dir_index = (dir_samples.base_index + i + cascade_size.dirs_count) % cascade_size.dirs_count;
        vec2 ray_dir = GetProbeDir(float(dir_index), cascade_size.dirs_count);
        
        vec2 ray_start = probe_screen_pos * vec2(viewport_size) + ray_dir * interval_length.x;
        vec2 ray_end = probe_screen_pos * vec2(viewport_size) + ray_dir * interval_length.y;                

        RayHit ray_hit = radiance(iChannel1, ray_start, normalize(ray_end - ray_start), length(ray_end - ray_start));
        interp_interval += ray_hit.radiance * weights[i];
    }
    return interp_interval;
}

vec4 CastMergedIntervalInnerParallaxFix(ivec2 probe_index, vec2 dir, vec2 interval_length, int prev_cascade_index, int prev_dir_index)
{
    ivec2 face_size = textureSize(iChannel0, 0);    
    ivec2 viewport_size = textureSize(iChannel1, 0);
    CascadeSize c0_size = GetC0Size(viewport_size);
    CascadeSize prev_cascade_size = GetCascadeSize(prev_cascade_index, c0_size);
    int cascade_index = prev_cascade_index - 1;
    CascadeSize cascade_size = GetCascadeSize(cascade_index, c0_size);
    vec2 probe_screen_pos = GetProbeScreenPos(vec2(probe_index), cascade_index, c0_size);
    BilinearSamples bilinear_samples = GetProbeBilinearSamples(probe_screen_pos, prev_cascade_index, c0_size);
    vec4 weights = GetBilinearWeights(bilinear_samples.ratio);
    vec4 merged_interval = vec4(0.0f);
    for(int i = 0; i < 4; i++)
    {
        ProbeLocation prev_probe_location;
        prev_probe_location.cascade_index = prev_cascade_index;
        prev_probe_location.probe_index = clamp(bilinear_samples.base_index + GetBilinearOffset(i), ivec2(0), prev_cascade_size.probes_count - ivec2(1));
        prev_probe_location.dir_index = prev_dir_index;


        int pixel_index = ProbeLocationToPixelIndex(prev_probe_location, c0_size);
        ivec3 texel_index = PixelIndexToCubemapTexel(face_size, pixel_index);

        vec4 prev_interval = vec4(0.0f, 0.0f, 0.0f, 1.0f);
        if(prev_cascade_index < nCascades)
            prev_interval = cubemapFetch(iChannel0, texel_index.z, texel_index.xy);

        vec2 prev_screen_pos = GetProbeScreenPos(vec2(prev_probe_location.probe_index), prev_probe_location.cascade_index, c0_size);

        vec2 ray_start = probe_screen_pos * vec2(viewport_size) + dir * interval_length.x;
        vec2 ray_end = prev_screen_pos * vec2(viewport_size) + dir * interval_length.y;
        
        vec2 ray_dir = normalize(ray_end - ray_start);
        float dir_indexf = GetDirIndexf(ray_dir, cascade_size.dirs_count);

        vec4 ray_hit_radiance = CastInterpProbeDir(probe_index, cascade_index, interval_length, dir_indexf);
        merged_interval += MergeIntervals(ray_hit_radiance, prev_interval) * weights[i];
    }
    return merged_interval;
}


void mainCubemap(out vec4 fragColor, vec2 fragCoord, vec3 fragRO, vec3 fragRD) {
    // Calculate the index for this cubemap texel
    int face;
    
    if (abs(fragRD.x) > abs(fragRD.y) && abs(fragRD.x) > abs(fragRD.z)) {
        face = fragRD.x > 0.0 ? 0 : 1;
    } else if (abs(fragRD.y) > abs(fragRD.z)) {
        face = fragRD.y > 0.0 ? 2 : 3;
    } else {
        face = fragRD.z > 0.0 ? 4 : 5;
    }
    
    ivec2 face_size = textureSize(iChannel0, 0);
    
    ivec2 face_pixel = ivec2(fragCoord.xy);
    int face_index = face;
    int pixel_index = face_pixel.x + face_pixel.y * face_size.x + face_index * (face_size.x * face_size.y);
    
    ivec2 viewport_size = textureSize(iChannel1, 0);
    CascadeSize c0_size = GetC0Size(viewport_size);
    ProbeLocation probe_location = PixelIndexToProbeLocation(pixel_index, c0_size);
    
    if(probe_location.cascade_index >= nCascades)
    {
        fragColor = vec4(0.0f, 0.0f, 0.0f, 1.0f);
        return;
    }
    vec2 interval_overlap = vec2(1.0f, 1.0f);
    #if MERGE_FIX == 4 || MERGE_FIX == 5 //parallax fix works better with overlapping intervals
        interval_overlap = vec2(1.0f, 1.1f);
    #endif
    vec2 interval_length = GetCascadeIntervalScale(probe_location.cascade_index) * GetC0IntervalLength(viewport_size) * interval_overlap;
    CascadeSize cascade_size = GetCascadeSize(probe_location.cascade_index, c0_size);
    int prev_cascade_index = probe_location.cascade_index + 1;
    CascadeSize prev_cascade_size = GetCascadeSize(prev_cascade_index, c0_size);
    
    vec2 screen_pos = GetProbeScreenPos(vec2(probe_location.probe_index), probe_location.cascade_index, c0_size);
    
    int avg_dirs_count = prev_cascade_size.dirs_count / cascade_size.dirs_count;
    
    vec4 merged_avg_interval = vec4(0.0f);
    for(int dir_number = 0; dir_number < avg_dirs_count; dir_number++)
    {
        int prev_dir_index = probe_location.dir_index * avg_dirs_count + dir_number;
        vec2 ray_dir = GetProbeDir(float(prev_dir_index), prev_cascade_size.dirs_count);
        
        #if MERGE_FIX == 0
            vec4 merged_inteval = CastMergedInterval(screen_pos, ray_dir, interval_length, prev_cascade_index, prev_dir_index);
        #elif MERGE_FIX == 1
            vec4 merged_inteval = CastMergedIntervalBilinearFix(screen_pos, ray_dir, interval_length, prev_cascade_index, prev_dir_index);
        #elif MERGE_FIX == 2
            vec4 merged_inteval = CastMergedIntervalMidpointBilinearFix(screen_pos, ray_dir, interval_length, prev_cascade_index, prev_dir_index);
        #elif MERGE_FIX == 3
            vec4 merged_inteval = CastMergedIntervalMaskFix(screen_pos, ray_dir, interval_length, prev_cascade_index, prev_dir_index);
        #elif MERGE_FIX == 4
            vec4 merged_inteval = CastMergedIntervalParallaxFix(screen_pos, ray_dir, interval_length, prev_cascade_index, prev_dir_index);
        #elif MERGE_FIX == 5
            vec4 merged_inteval = CastMergedIntervalInnerParallaxFix(probe_location.probe_index, ray_dir, interval_length, prev_cascade_index, prev_dir_index);
        #endif
        merged_avg_interval += merged_inteval / float(avg_dirs_count);  
    }
    fragColor = merged_avg_interval;
    // fragColor = vec4(0.0f, 1.0f, 0.0f, 1.0f);
}

uniform vec4 unViewport;
uniform vec3 unCorners[5];
out vec4 outColor;

void main( void ) {
  vec4 color = vec4(1e20);
  vec3 ro = unCorners[4];
  vec2 uv = (gl_FragCoord.xy - unViewport.xy)/unViewport.zw;
  vec3 rd = normalize( mix( mix( unCorners[0], unCorners[1], uv.x ),mix( unCorners[3], unCorners[2], uv.x ), uv.y ) - ro);
  mainCubemap( color, gl_FragCoord.xy-unViewport.xy, ro, rd );
  outColor = color; 
}

`;

const imageShaderSrc = `#version 300 es
precision highp float;
uniform samplerCube iChannel0; 
uniform sampler2D iChannel1;
uniform vec2 resolution;

out vec4 fragColor;

${commonShaderSrc}

void main() {
   
    ivec2 viewport_size = ivec2(resolution.xy);
    ivec2 face_size = textureSize(iChannel0, 0);
    
    vec2 screen_pos = gl_FragCoord.xy / vec2(viewport_size);

    CascadeSize c0_size = GetC0Size(viewport_size);
    int src_cascade_index = 0;
    
    CascadeSize cascade_size = GetCascadeSize(src_cascade_index, c0_size);
    
    BilinearSamples bilinear_samples = GetProbeBilinearSamples(screen_pos, src_cascade_index, c0_size);
    vec4 weights = GetBilinearWeights(bilinear_samples.ratio);
    
    vec4 fluence = vec4(0.0f);
    for(int dir_index = 0; dir_index < cascade_size.dirs_count; dir_index++)
    {
        #if C_MINUS1_GATHERING == 1
            vec2 c0_dir = GetProbeDir(float(dir_index), c0_size.dirs_count);
            vec2 c0_interval_length = GetCascadeIntervalScale(0) * GetC0IntervalLength(viewport_size);
            vec4 c_minus1_radiance = radiance(iChannel1, screen_pos * vec2(viewport_size), c0_dir, c0_interval_length.x).radiance;
        #else
            vec4 c_minus1_radiance = vec4(vec3(0.0f), 1.0f);
        #endif
        
        vec4 c0_radiance = vec4(0.0f);
        for(int i = 0; i < 4; i++)
        {
            ProbeLocation probe_location;
            probe_location.cascade_index = src_cascade_index;
            probe_location.probe_index = clamp(bilinear_samples.base_index + GetBilinearOffset(i), ivec2(0), cascade_size.probes_count- ivec2(1));
            probe_location.dir_index = dir_index;
            
            int pixel_index = ProbeLocationToPixelIndex(probe_location, c0_size);
            ivec3 texel_index = PixelIndexToCubemapTexel(face_size, pixel_index);
            
            
            vec4 src_radiance = cubemapFetch(iChannel0, texel_index.z, texel_index.xy);
            
            c0_radiance += src_radiance * weights[i];
        }
        fluence += MergeIntervals(c_minus1_radiance, c0_radiance) / float(cascade_size.dirs_count);
    }
    
    // Overlay actual SDF drawing to fix low resolution edges
    // vec4 data = sampleDrawing(iChannel1, fragCoord);
    // fluence = mix(fluence, data * 2.0 * PI, clamp(3.0 - data.r, 0.0, 1.0));
    // Tonemap
    //fragColor = vec4(pow(fluence / (fluence + 1.0), vec3(1.0/2.5)), 1.0);
    fragColor = vec4(1.0 - 1.0 / pow(1.0 + fluence.rgb, vec3(2.5)), 1.0);
}
`;

const vertexShaderSrc = `#version 300 es
in vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

let bufferATextureIndex = 0;
let bufferBTextureIndex = 0;
let cubeATextureIndex = 0;




// Setup WebGL and create shaders for each buffer
// const commonShader = createShader(gl, gl.FRAGMENT_SHADER, commonShaderSrc);
const bufferAShader = createShader(gl, gl.FRAGMENT_SHADER, bufferAShaderSrc);
const bufferBShader = createShader(gl, gl.FRAGMENT_SHADER, bufferBShaderSrc);
const cubeAShader = createShader(gl, gl.FRAGMENT_SHADER, cubeAShaderSrc);
const imageShader = createShader(gl, gl.FRAGMENT_SHADER, imageShaderSrc);

// const shaderProgram = createProgram(gl, vertexShaderSrc, commonShaderSrc);
const bufferAProgram = createProgram(gl, vertexShaderSrc, bufferAShaderSrc);
const bufferBProgram = createProgram(gl, vertexShaderSrc, bufferBShaderSrc);
const cubeAProgram = createProgram(gl, vertexShaderSrc, cubeAShaderSrc);
const imageProgram = createProgram(gl, vertexShaderSrc, imageShaderSrc);

const setRenderTarget = (fbo) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbId);
}

const setRenderTargetCubeMap = function (fbo, face)
  {
    if( fbo===null )
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    else
    {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbId);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X+face, fbo.colorTexture, 0);
        // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X+face, fbo.mTex0.mObjectID, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
          console.error("Framebuffer not complete");
      }
    }
  };
const renderCubemap = (face) => {
  gl.viewport(0, 0, CUBEMAP_RES, CUBEMAP_RES);

  let corA = [-1.0, -1.0, -1.0];
  let corB = [ 1.0, -1.0, -1.0];
  let corC = [ 1.0,  1.0, -1.0];
  let corD = [-1.0,  1.0, -1.0];
  let apex = [ 0.0,  0.0,  0.0];

       if( face===0 ) { corA=[ 1.0,  1.0,  1.0]; corB=[ 1.0,  1.0, -1.0]; corC=[ 1.0, -1.0, -1.0]; corD=[ 1.0, -1.0,  1.0]; }
  else if( face===1 ) { corA=[-1.0,  1.0, -1.0]; corB=[-1.0,  1.0,  1.0]; corC=[-1.0, -1.0,  1.0]; corD=[-1.0, -1.0, -1.0]; }
  else if( face===2 ) { corA=[-1.0,  1.0, -1.0]; corB=[ 1.0,  1.0, -1.0]; corC=[ 1.0,  1.0,  1.0]; corD=[-1.0,  1.0,  1.0]; }
  else if( face===3 ) { corA=[-1.0, -1.0,  1.0]; corB=[ 1.0, -1.0,  1.0]; corC=[ 1.0, -1.0, -1.0]; corD=[-1.0, -1.0, -1.0]; }
  else if( face===4 ) { corA=[-1.0,  1.0,  1.0]; corB=[ 1.0,  1.0,  1.0]; corC=[ 1.0, -1.0,  1.0]; corD=[-1.0, -1.0,  1.0]; }
  else if( face===5 ) { corA=[ 1.0,  1.0, -1.0]; corB=[-1.0,  1.0, -1.0]; corC=[-1.0, -1.0, -1.0]; corD=[ 1.0, -1.0, -1.0]; }

  let corners = [ corA[0], corA[1], corA[2], 
                  corB[0], corB[1], corB[2], 
                  corC[0], corC[1], corC[2], 
                  corD[0], corD[1], corD[2],

                  apex[0], apex[1], apex[2]];

  // this.mRenderer.SetShaderConstant3FV("unCorners", corners);
  // this.mRenderer.SetShaderConstant4FV("unViewport", vp);
  // In pure WebGL, you would set the uniforms like this:
  const cornersLocation = gl.getUniformLocation(cubeAProgram, 'unCorners');
  gl.uniform3fv(cornersLocation, corners);
  // And the same for the viewport
  const viewportLocation = gl.getUniformLocation(cubeAProgram, 'unViewport');
  gl.uniform4fv(viewportLocation, [0, 0, CUBEMAP_RES, CUBEMAP_RES]);

  // Draw the quad
  drawQuad(gl);
}

// Create the render loop
function render() {
    // Toggle between the two textures
    bufferATextureIndex = 1 - bufferATextureIndex;
    bufferBTextureIndex = 1 - bufferBTextureIndex;
    cubeATextureIndex = 1 - cubeATextureIndex;

    // Render to Buffer A
    setRenderTarget(bufferA.targets[bufferATextureIndex]); // Ensure framebuffer is bound
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bufferA.textures[bufferATextureIndex], 0);  // Attach the texture
    
    // Use the other texture as input
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bufferA.textures[1 - bufferATextureIndex]);
    
    useShader(gl, bufferAProgram);
    drawQuad(gl);

    // Render to Buffer B
    setRenderTarget(bufferB.targets[bufferBTextureIndex]);  // Ensure framebuffer is bound
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bufferB.textures[bufferBTextureIndex], 0);  // Attach the texture
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bufferB.textures[1 - bufferBTextureIndex]);


    useShader(gl, bufferBProgram);
    drawQuad(gl);

    // Render to Cubemap
    useShader(gl, cubeAProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapBuffer.textures[1 - cubeATextureIndex]);
    const samplerLocationCube = gl.getUniformLocation(cubeAProgram, 'iChannel0');
    gl.uniform1i(samplerLocationCube, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bufferB.textures[1 - bufferBTextureIndex]);
    const samplerLocation = gl.getUniformLocation(cubeAProgram, 'iChannel1');
    gl.uniform1i(samplerLocation, 1);

    for( let face=0; face<6; face++ )
      {
          setRenderTargetCubeMap(cubemapBuffer.targets[cubeATextureIndex], face);  // Ensure framebuffer is bound
          renderCubemap(face);
          // this.Paint_Cubemap( vrData, wa, da, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, buffers, cubeBuffers, keyboard, face );
      }
      setRenderTargetCubeMap( null, 0 ); 




    // Render final Image to the screen
    bindFramebuffer(gl, null);  // Render to the screen (null unbinds the framebuffer)
    useShader(gl, imageProgram);

    // Bind the output textures from the buffers as input for the final image
    // gl.activeTexture(gl.TEXTURE1);
    // gl.bindTexture(gl.TEXTURE_2D, bufferB.textures[bufferATextureIndex]);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bufferB.textures[bufferBTextureIndex]);

    const samplerLocation1 = gl.getUniformLocation(imageProgram, 'iChannel1');
    gl.uniform1i(samplerLocation1, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapBuffer.textures[cubeATextureIndex]);

    const samplerLocationCube1 = gl.getUniformLocation(imageProgram, 'iChannel0');
    gl.uniform1i(samplerLocationCube1, 0);

    drawQuad(gl);

    requestAnimationFrame(render);

}

render();



// Utility functions to create shaders, framebuffers, etc.
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        console.error(source);
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShaderSource, fragmentShaderSource) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  if (!vertexShader || !fragmentShader) {
      console.error("Failed to compile shaders.");
      return null;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program linking failed: " + gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
  }

  return program;
}

function createRenderTarget(colorTexture) {
    const fbId = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbId);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {
        fbId,
        colorTexture: colorTexture,
    };
}

function createRenderTargetCubemap(colorTexture) {
    const fbId = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbId);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X, colorTexture, 0);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) != gl.FRAMEBUFFER_COMPLETE) {
      console.log("Framebuffer is not complete! CreateRenderTarget");
      return null;
    } else {
      console.log("Framebuffer is complete! CreateRenderTarget");
    }

    return {
        fbId,
        colorTexture: colorTexture,
    };
  }

function bindFramebuffer(gl, framebuffer) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer ? framebuffer.framebuffer : null);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}

function useShader(gl, shader) {
    gl.useProgram(shader);
    // Set shader uniforms here, like time, resolution, etc.
    // Set resolution uniform
    const resolutionLocation = gl.getUniformLocation(shader, 'resolution');
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(gl.getUniformLocation(shader, 'iTime'), performance.now() / 1000);
}

function drawQuad(gl) {
    const vertices = new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0,
    ]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const position = gl.getAttribLocation(bufferAProgram, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}


