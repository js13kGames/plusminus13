// This engine is an adaptation of Jason McGhee's (jason.today) radiance cascades (https://jason.today/rc)
// The original is a Three.js implementation provided under the MIT license, and this engine is a port to raw WebGL2
import rcSrc from "./shaders/rc.fragment.glsl";
import dfSrc from "./shaders/df.fragment.glsl";

// Utility functions
function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type) || "";
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compilation error:", gl.getShaderInfoLog(shader));
    console.log(source);
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader | null,
  fragmentShader: WebGLShader | null,
) {
  const program = gl.createProgram();
  if (!program || !vertexShader || !fragmentShader) {
    console.error("Program creation error");
    throw new Error("Program linking error");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program linking error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    throw new Error("Program linking error");
  }
  return program;
}

function createTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  internalFormat: number,
  format: number,
  type: number,
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
export default class WebGLRenderer {
  canvas: HTMLCanvasElement | null;
  gl: WebGL2RenderingContext;
  rawBasePixelsBetweenProbes: number;
  width: number;
  height: number;
  dfUniformsSync: boolean;
  rcUniformsSync: boolean;
  renderWidth: number;
  renderHeight: number;
  radianceCascades: number;
  basePixelsBetweenProbes: number;
  radianceInterval: number;
  radianceWidth: number;
  radianceHeight: number;
  firstLayer: number;
  lastLayer: number;
  rayInterval: number;
  baseRayCount: number;
  sunAngle: number;
  srgb: number;
  enableSun: boolean;
  addNoise: boolean;
  firstCascadeIndex: number;
  attributeLocations: any;
  uniforms: {
    u_resolution: number[];
    u_cascadeExtent: number[];
    u_cascadeCount: number;
    u_basePixelsBetweenProbes: number;
    u_cascadeInterval: number;
    u_rayInterval: number;
    u_baseRayCount: number;
    u_sunAngle: number;
    u_time: number;
    u_srgb: number;
    u_enableSun: boolean;
    u_addNoise: boolean;
    u_firstCascadeIndex: number;
  };
  uniformLocations: any;
  distanceFieldProgram!: WebGLProgram;
  rcProgram!: WebGLProgram;
  distanceFieldTexture!: WebGLTexture | null;
  positionBuffer!: WebGLBuffer | null;
  rcTextures!: (WebGLTexture | null)[];
  distanceFieldFBO!: WebGLFramebuffer | null;
  rcFBOs!: (WebGLFramebuffer | null)[];

  constructor(canvasId: string, width: number, height: number) {
    this.rawBasePixelsBetweenProbes = 2.0;
    this.width = width;
    this.height = height;

    this.uniformLocations = {};
    this.attributeLocations = {};
    this.dfUniformsSync = false;
    this.rcUniformsSync = false;

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

    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error("Canvas not found");
      return;
    }
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl = this.canvas.getContext("webgl2", {
      alpha: false,
      powerPreference: "high-performance",
    })!;

    if (!this.gl) {
      console.error("WebGL 2 not supported");
      throw new Error("WebGL 2 not supported");
    }

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.depthMask(false);

    this.gl.getExtension("OES_texture_float_linear");
    this.gl.getExtension("OES_texture_half_float_linear");
    this.gl.getExtension("EXT_color_buffer_float");
    const mAsynchCompile = this.gl.getExtension("KHR_parallel_shader_compile");

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

    const distanceFieldFragmentShaderSource = dfSrc;
    const rcFragmentShaderSource2 = rcSrc;
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

  render(uniforms: any) {
    this.renderDistanceField(uniforms);
    this.renderRadianceCascades(uniforms);
  }

  cachedULoc(program: string, name: string) {
    if (this.uniformLocations[program][name]) {
      return this.uniformLocations[program][name];
    } else {
      const p = program === "df" ? this.distanceFieldProgram : this.rcProgram;
      const location = this.gl.getUniformLocation(p, name);
      this.uniformLocations[program][name] = location;
      return location;
    }
  }

  renderDistanceField(uniforms: any) {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.distanceFieldFBO);

    this.gl.useProgram(this.distanceFieldProgram);

    const timeUniformLocation = this.cachedULoc("df", "u_time");
    this.gl.uniform1f(timeUniformLocation, performance.now() / 1000.0);

    this.syncUniforms("df", uniforms);
    if (!this.dfUniformsSync) {
      const resolutionLocation = this.cachedULoc("df", "u_resolution");
      this.gl.uniform2f(resolutionLocation, this.width, this.height);
      this.syncUniforms("df", this.uniforms);
      this.dfUniformsSync = true;
    }

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  setupVertexAttributes() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

    const setupAttribute = (location: number) => {
      this.gl.enableVertexAttribArray(location);
      this.gl.vertexAttribPointer(location, 2, this.gl.FLOAT, false, 0, 0);
    };

    setupAttribute(this.attributeLocations.df.position);
    setupAttribute(this.attributeLocations.rc.position);
  }

  syncUniforms(program: string, uniforms: any) {
    for (const [name, value] of Object.entries(uniforms)) {
      const location = this.cachedULoc(program, name);
      if (location !== null) {
        if (name === "u_boxes") {
          this.gl.uniformMatrix4fv(location, false, value as Float32Array);
        } else if (Array.isArray(value)) {
          (this.gl as any)[`uniform${value.length}fv`](location, value);
        } else if (typeof value === "boolean") {
          this.gl.uniform1i(location, value ? 1 : 0);
        } else {
          this.gl.uniform1f(location, value as number);
        }
      }
    }
  }
  renderRadianceCascades(uniforms: any) {
    this.gl.useProgram(this.rcProgram);

    if (!this.rcUniformsSync) {
      this.syncUniforms("rc", this.uniforms);
      this.rcUniformsSync = true;
    }
    this.syncUniforms("rc", uniforms);

    const timeUniformLocation = this.cachedULoc("rc", "u_time");

    const cascadeIndexUniformLocation = this.cachedULoc("rc", "u_cascadeIndex");
    const distanceTextureUniformLocation = this.cachedULoc("rc", "u_distanceTexture");

    this.gl.uniform1i(distanceTextureUniformLocation, 0);
    const lastTextureUniformLocation = this.cachedULoc("rc", "u_lastTexture");
    this.gl.uniform1i(lastTextureUniformLocation, 1);

    // Set u_lastTexture to null
    this.gl.activeTexture(this.gl.TEXTURE1);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

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
}
