// WebGL Renderer Implementation

// Utility functions
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program linking error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function createTexture(
  gl,
  width,
  height,
  internalFormat,
  format,
  type,
  linear = false,
  data = null,
) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, data);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    linear ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Generate mipmaps if linear

  return texture;
}

// Main WebGL Renderer class
class WebGLRenderer {
  constructor(canvasId, width, height) {
    this.canvas = document.getElementById(canvasId);
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl = this.canvas.getContext("webgl2", {
      alpha: false,
      powerPreference: "high-performance",
    });
    if (!this.gl) {
      console.error("WebGL 2 not supported");
      return;
    }
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.depthMask(false);
    // Check for necessary extensions
    // const ext = this.gl.getExtension("EXT_color_buffer_float");
    // if (!ext) {
    //   console.error("EXT_color_buffer_float is not supported");
    //   return null;
    // }

    // const linearFilteringExt = this.gl.getExtension("OES_texture_float_linear");

    this.rawBasePixelsBetweenProbes = 2.0;
    this.width = width;
    this.height = height;

    this.uniformLocations = {};
    this.attributeLocations = {};
    this.dfUniformsSync = false;
    this.rcUniformsSync = false;

    this.initializeParameters();
    this.initializeShaders();
    this.initializeBuffers();
    this.initializeTextures();
    this.initializeFramebuffers();

    this.attributeLocations.df = {
      position: this.gl.getAttribLocation(this.distanceFieldProgram, "a_position"),
    };
    this.attributeLocations.rc = {
      position: this.gl.getAttribLocation(this.rcProgram, "a_position"),
    };

    this.setupVertexAttributes();
    // Set uniforms
    this.uniforms = {
      u_resolution: [this.width, this.height],
      u_cascadeExtent: [this.radianceWidth, this.radianceHeight],
      u_cascadeCount: this.radianceCascades,
      u_basePixelsBetweenProbes: this.basePixelsBetweenProbes,
      u_cascadeInterval: this.radianceInterval,
      u_rayInterval: this.rayInterval,
      u_baseRayCount: this.baseRayCount,
      u_sunAngle: this.sunAngle,
      u_time: performance.now() / 1000.0,
      u_srgb: this.srgb,
      u_enableSun: this.enableSun,
      u_addNoise: this.addNoise,
      u_firstCascadeIndex: this.firstCascadeIndex,
    };
  }

  initializeParameters() {
    this.renderWidth = this.width;
    this.renderHeight = this.height;

    const angularSize = Math.sqrt(
      this.renderWidth * this.renderWidth + this.renderHeight * this.renderHeight,
    );
    this.radianceCascades = Math.ceil(Math.log(angularSize) / Math.log(4)) + 1.0;
    this.basePixelsBetweenProbes = this.rawBasePixelsBetweenProbes;
    this.radianceInterval = 1.0;

    this.radianceWidth = Math.floor(this.renderWidth / this.basePixelsBetweenProbes);
    this.radianceHeight = Math.floor(this.renderHeight / this.basePixelsBetweenProbes);

    this.firstLayer = this.radianceCascades - 1;
    this.lastLayer = 0;

    // Additional parameters
    this.rayInterval = 1.0;
    this.baseRayCount = Math.pow(4.0, 1.0); // Assuming baseRayCount of 1.0
    this.sunAngle = 0.0;
    this.srgb = 2.2; // Assuming sRGB is enabled
    this.enableSun = false;
    this.addNoise = false;
    this.firstCascadeIndex = 0;
  }

  initializeShaders() {
    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      out vec2 vUv;
      void main() {
        vUv = (a_position + 1.0) * 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const distanceFieldFragmentShaderSource = `#version 300 es

        precision highp float;
          uniform float u_time;
          in vec2 vUv;
          out vec4 FragColor;
  
          float sdCircle(vec2 p, vec2 center, float radius) {
            return length(p - center) - radius;
          }
  
          float sdCapsule(vec2 p, vec2 a, vec2 b, float r) {
            vec2 pa = p - a, ba = b - a;
            float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
            return length(pa - ba * h) - r;
          }
          void main() {
  
          float PI = 3.14159265359;
  
            vec2 p = gl_FragCoord.xy;
           float minDistance = 999999.9;
            vec4 color = vec4(0.0);
  
            float speed = 1.0 + sin(u_time);
           // Clamp by the size of our texture (1.0 in uv space).
            float distance = sdCircle(vUv, vec2(0.2, 0.5 + cos(speed + u_time) * 0.2), 0.05);
  
            if (distance < minDistance) {
              minDistance = distance;
              color.xyz = vec3(0.0, 0.5 + 0.5*cos(speed + u_time), 1.0); 
            }
  
            distance = sdCircle(vUv, vec2(0.4, 0.5 + cos(speed + (u_time + PI*0.1)) * 0.2), 0.05);
  
            if (distance < minDistance) {
              minDistance = distance;
              color.xyz = vec3(0.25 + 0.25*sin(speed + (u_time + PI*0.2)), 0.5 + 0.5*cos(speed + (u_time + PI*0.1)), 1.0); 
            }
  
            // Add a circle that circles
            distance = sdCircle(vUv, vec2(0.6, 0.5 + cos(speed+(u_time + PI*0.2)) * 0.2), 0.05);
            if (distance < minDistance) {
              minDistance = distance;
              color.xyz = vec3(0.50 + 0.50*sin(speed + (u_time + PI*0.4)), 0.5 + 0.5*cos(speed+(u_time + PI*0.2)), 1.0); 
            }
  
            // One more 
            distance = sdCircle(vUv, vec2(0.8, 0.5 + cos(speed+(u_time + PI*0.3)) * 0.2), 0.05);
            if (distance < minDistance) {
              minDistance = distance;
              color.xyz = vec3(0.75 + 0.25*sin(speed + (u_time + PI*0.6)), 0.5 + 0.5*cos(speed+(u_time + PI*0.3)), 1.0); 
            }
  
            // Add a fixed capsule
            distance = sdCapsule(vUv, vec2(0.5, 0.5), vec2(0.5, 0.7), 0.02);
            if (distance < minDistance) {
              minDistance = distance;
              color.xyz = vec3(0.0, 0.0, 1.0); 
            }
  
            // Add a fixed capsule
            distance = sdCapsule(vUv, vec2(0.3, 0.2), vec2(0.3, 0.4), 0.02);
            if (distance < minDistance) {
              minDistance = distance;
              color.xyz = vec3(0.0, 0.0, 1.0); 
            }
  
            // Add a fixed capsule
            distance = sdCapsule(vUv, vec2(0.7, 0.2), vec2(0.7, 0.4), 0.02);
            if (distance < minDistance) {
              minDistance = distance;
              color.xyz = vec3(0.0, 0.0, 1.0); 
            }
            minDistance = clamp(minDistance, 0.0, 1.0);    
  
        
            // Normalize and visualize the distance
            FragColor = vec4(minDistance, color.xyz);
          }`;
    const rcFragmentShaderSource2 = `#version 300 es
    #ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_resolution;
// uniform sampler2D sceneTexture;
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

vec4 safeTextureSample(sampler2D tex, vec2 uv, float lod) {
    vec4 color = texture(tex, uv);
    return vec4(color.rgb, color.a);
}

vec4 colorSample(sampler2D tex, vec2 uv, bool srgbSample) {
    vec4 color = texture(tex, uv);
    if (!srgbSample) {
      return color;
    }
    return vec4(pow(color.rgb, vec3(u_srgb)), color.a);
}

vec4 colorWSample(sampler2D tex, vec2 uv, bool srgbSample) {
    vec3 color = texture(tex, uv).gba;
    return vec4(0.0, color);
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

        if (df <= minStepSize) {
          ivec2 texel = ivec2(int(rayUv.x * u_resolution.x), int(rayUv.y * u_resolution.y));
          vec4 color = vec4(0.0, texelFetch(u_distanceTexture, texel, 0).gba);
          color.rgb = pow(color.rgb, vec3(u_srgb));
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
  
  void main() {
      vec2 coord = floor(vUv * u_cascadeExtent);
  
      if (u_cascadeIndex == 0.0) {
        ivec2 texel = ivec2(int(vUv.x * u_resolution.x), int(vUv.y * u_resolution.y));
        vec4 color = texelFetch(u_distanceTexture, texel, 0); // sceneTexture !!!
        // Calculate 1 pixel distance
        float minStepSize = min(1.0 / u_resolution.x, 1.0 / u_resolution.y);
        if (color.r < minStepSize) {
            FragColor = vec4(0.0, color.gba);
            // FragColor = vec4(color.r, 0.0, 1.0, 1.0);
            // FragColor = color.rgba;
            return;
        }
      }
  
      float base = u_baseRayCount;
      float rayCount = pow(base, u_cascadeIndex + 1.0);
      float sqrtBase = sqrt(u_baseRayCount);
      float spacing = pow(sqrtBase, u_cascadeIndex);
  
      // Hand-wavy rule that improved smoothing of other base ray counts
      float modifierHack = base < 16.0 ? pow(u_basePixelsBetweenProbes, 1.0) : sqrtBase;
  
      vec2 size = floor(u_cascadeExtent / spacing);
      vec2 probeRelativePosition = mod(coord, size);
      vec2 rayPos = floor(coord / size);
  
      float modifiedInterval = modifierHack * u_rayInterval * u_cascadeInterval;
  
      float start = u_cascadeIndex == 0.0 ? u_cascadeInterval : modifiedInterval;
      vec2 interval = (start * pow(base, (u_cascadeIndex - 1.0))) / u_resolution;
      float intervalLength = ((modifiedInterval) * pow(base, u_cascadeIndex));
  
      vec2 probeCenter = (probeRelativePosition + 0.5) * u_basePixelsBetweenProbes * spacing;
  
      float preAvgAmt = u_baseRayCount;
  
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
  
      FragColor = vec4(
        (u_cascadeIndex > u_firstCascadeIndex)
          ? totalRadiance.rgb
          : pow(totalRadiance.rgb, vec3(1.0 / u_srgb)),
        totalRadiance.a
      );
    }`;
    const vertexShader = createShader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource);
    const distanceFieldFragmentShader = createShader(
      this.gl,
      this.gl.FRAGMENT_SHADER,
      distanceFieldFragmentShaderSource,
    );
    const rcFragmentShader = createShader(
      this.gl,
      this.gl.FRAGMENT_SHADER,
      rcFragmentShaderSource2,
    );

    this.distanceFieldProgram = createProgram(this.gl, vertexShader, distanceFieldFragmentShader);
    this.rcProgram = createProgram(this.gl, vertexShader, rcFragmentShader);
    this.uniformLocations.df = {};
    this.uniformLocations.rc = {};
    this.attributeLocations.df = {};
    this.attributeLocations.rc = {};
  }

  initializeBuffers() {
    const positions = new Float32Array([
      -1,
      -1, // bottom-left
      1,
      -1, // bottom-right
      -1,
      1, // top-left
      1,
      1, // top-right
    ]);
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
  }

  initializeTextures() {
    // Check for floating point texture support
    const ext = this.gl.getExtension("EXT_color_buffer_float");
    if (!ext) {
      console.error("Floating point textures not supported");
      return;
    }

    this.distanceFieldTexture = createTexture(
      this.gl,
      this.width,
      this.height,
      this.gl.RGBA16F,
      this.gl.RGBA,
      this.gl.HALF_FLOAT,
    );

    this.rcTextures = [
      createTexture(
        this.gl,
        this.width,
        this.height,
        this.gl.RGBA16F,
        this.gl.RGBA,
        this.gl.HALF_FLOAT,
        true,
      ),
      createTexture(
        this.gl,
        this.width,
        this.height,
        this.gl.RGBA16F,
        this.gl.RGBA,
        this.gl.HALF_FLOAT,
        true,
      ),
    ];
  }

  initializeFramebuffers() {
    this.distanceFieldFBO = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.distanceFieldFBO);
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      this.distanceFieldTexture,
      0,
    );

    this.rcFBOs = this.rcTextures.map((texture) => {
      const fbo = this.gl.createFramebuffer();
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
      this.gl.framebufferTexture2D(
        this.gl.FRAMEBUFFER,
        this.gl.COLOR_ATTACHMENT0,
        this.gl.TEXTURE_2D,
        texture,
        0,
      );
      return fbo;
    });
  }

  render() {
    this.renderDistanceField();
    this.renderRadianceCascades();
  }
  cachedULoc(program, name) {
    if (this.uniformLocations[program][name]) {
      return this.uniformLocations[program][name];
    } else {
      const p = program === "df" ? this.distanceFieldProgram : this.rcProgram;
      const location = this.gl.getUniformLocation(p, name);
      this.uniformLocations[program][name] = location;
      return location;
    }
  }

  // cachedALoc(program, name) {
  //   if (this.attributeLocations[program][name]) {
  //     return this.attributeLocations[program][name];
  //   } else {
  //     const location = this.gl.getAttribLocation(program, name);
  //     this.attributeLocations[program][name] = location;
  //     return location;
  //   }
  // }

  renderDistanceField() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.distanceFieldFBO);

    this.gl.useProgram(this.distanceFieldProgram);

    const timeUniformLocation = this.cachedULoc("df", "u_time");
    this.gl.uniform1f(timeUniformLocation, performance.now() / 1000.0);

    if (!this.dfUniformsSync) {
      const resolutionLocation = this.cachedULoc("df", "u_resolution");
      this.gl.uniform2f(resolutionLocation, this.width, this.height);
      this.dfUniformsSync = true;
    }

    // const positionAttributeLocation = this.gl.getAttribLocation(
    //   this.distanceFieldProgram,
    //   "a_position",
    // );

    // this.gl.enableVertexAttribArray(positionAttributeLocation);
    // this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    // this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  setupVertexAttributes() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

    const setupAttribute = (location) => {
      this.gl.enableVertexAttribArray(location);
      this.gl.vertexAttribPointer(location, 2, this.gl.FLOAT, false, 0, 0);
    };

    setupAttribute(this.attributeLocations.df.position);
    setupAttribute(this.attributeLocations.rc.position);
  }

  renderRadianceCascades() {
    this.gl.useProgram(this.rcProgram);

    if (!this.rcUniformsSync) {
      for (const [name, value] of Object.entries(this.uniforms)) {
        const location = this.cachedULoc("rc", name);
        if (location !== null) {
          if (Array.isArray(value)) {
            this.gl[`uniform${value.length}fv`](location, value);
          } else if (typeof value === "boolean") {
            this.gl.uniform1i(location, value ? 1 : 0);
          } else {
            this.gl.uniform1f(location, value);
          }
        }
      }
      this.rcUniformsSync = true;
    }

    const timeUniformLocation = this.cachedULoc("rc", "u_time");

    const cascadeIndexUniformLocation = this.cachedULoc("rc", "u_cascadeIndex");
    const distanceTextureUniformLocation = this.cachedULoc("rc", "u_distanceTexture");

    this.gl.uniform1i(distanceTextureUniformLocation, 0);
    const lastTextureUniformLocation = this.cachedULoc("rc", "u_lastTexture");
    this.gl.uniform1i(lastTextureUniformLocation, 1);

    // Set u_lastTexture to null
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    // const positionAttributeLocation = this.gl.getAttribLocation(this.rcProgram, "a_position");
    // this.gl.enableVertexAttribArray(positionAttributeLocation);
    // this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    // this.gl.vertexAttribPointer(positionAttributeLocation, 2, this.gl.FLOAT, false, 0, 0);

    let prev = 0;
    for (let i = this.firstLayer; i >= this.lastLayer; i--) {
      this.gl.uniform1f(cascadeIndexUniformLocation, i);
      this.gl.uniform1f(timeUniformLocation, performance.now() / 1000.0);

      if (i === this.lastLayer) {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      } else {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.rcFBOs[prev]);
      }

      this.gl.activeTexture(this.gl.TEXTURE0);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.distanceFieldTexture);

      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

      // After we render, we set the u_lastTexture to the current texture
      this.gl.activeTexture(this.gl.TEXTURE1);
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.rcTextures[prev]);
      this.gl.generateMipmap(this.gl.TEXTURE_2D);

      prev = 1 - prev;
    }
  }

  animate() {
    this.render();
    requestAnimationFrame(() => this.animate());
  }
}

// Usage
const renderer = new WebGLRenderer("webgl-canvas", window.innerWidth, window.innerHeight);
renderer.animate();
