// This is the html plumbing / structure / controls for little canvases
function intializeCanvas({ id, canvas, startDrawing }) {
  const thisId = document.querySelector(`#${id}`);
  thisId.innerHTML = `
    <div style="display: flex; gap: 20px;">
    <div id="${id}-canvas-container"></div></div>`;
  const container = document.querySelector(`#${id}-canvas-container`);
  container.appendChild(canvas);

  canvas.addEventListener("mousedown", startDrawing);

  return { container };
}

const vertexShader = `
varying vec2 vUv;
void main() { 
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

class PaintableCanvas {
  constructor({ width, height, initialColor = "transparent", radius = 6, friction = 0.1 }) {
    this.isDrawing = false;
    this.currentMousePosition = { x: 0, y: 0 };
    this.lastPoint = { x: 0, y: 0 };
    this.currentPoint = { x: 0, y: 0 };

    this.currentColor = { r: 255, g: 255, b: 255, a: 255 };
    this.RADIUS = radius;
    this.FRICTION = friction;
    this.width = width;
    this.height = height;

    this.initialColor = initialColor;

    this.drawSmoothLine = (from, to) => {
      throw new Error("Missing implementation");
    };
  }

  createCanvas(width, height, initialColor) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = initialColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    return [canvas, context];
  }

  setupTexture(texture) {
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.format = THREE.RGBAFormat;
    texture.type = true ? THREE.HalfFloatType : THREE.FloatType;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;
  }

  updateTexture() {
    this.texture.needsUpdate = true;
  }

  startDrawing() {
    this.isDrawing = true;
    this.doDraw();
  }

  stopDrawing() {
    const wasDrawing = this.isDrawing;
    if (!wasDrawing) {
      return false;
    }
    this.isDrawing = false;
    return true;
  }

  doDraw() {
    this.drawSmoothLine({ x: 0, y: 0 }, { x: 0, y: 0 });
    this.lastPoint = this.currentPoint;
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.currentImageData = new ImageData(this.canvas.width, this.canvas.height);
    this.updateTexture();
  }
}

function threeJSInit(
  width,
  height,
  materialProperties,
  renderer = null,
  renderTargetOverrides = {},
  makeRenderTargets = undefined,
  extra = {},
) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const dpr = extra.dpr || window.devicePixelRatio || 1;

  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      antialiasing: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(dpr);
  }
  renderer.setSize(width, height);
  const renderTargetProps = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    type: !document.querySelector("#full-precision")?.checked
      ? THREE.HalfFloatType
      : THREE.FloatType,
    format: THREE.RGBAFormat,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    ...renderTargetOverrides,
  };

  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    glslVersion: THREE.GLSL3,
    ...materialProperties,
  });
  plane = new THREE.Mesh(geometry, material);
  scene.add(plane);

  return {
    plane,
    canvas: renderer.domElement,
    render: () => {
      renderer.render(scene, camera);
    },
    renderTargets: makeRenderTargets
      ? makeRenderTargets({ width, height, renderer, renderTargetProps })
      : (() => {
          const renderTargetA = new THREE.WebGLRenderTarget(
            extra?.width ?? width,
            extra?.height ?? height,
            renderTargetProps,
          );
          const renderTargetB = renderTargetA.clone();
          return [renderTargetA, renderTargetB];
        })(),
    renderer,
  };
}

class BaseSurface {
  constructor({ id, width, height, radius = 5, dpr = 1 }) {
    // Create PaintableCanvas instances
    this.createSurface(width, height, radius);
    this.dpr = dpr || window.devicePixelRatio || 1;
    this.width = width;
    this.height = height;
    this.id = id;
    this.initialized = false;
    this.initialize();
  }

  createSurface(width, height, radius) {
    this.surface = new PaintableCanvas({ width, height, radius });
  }

  initialize() {
    // Child class should fill this out
  }

  load() {
    // Child class should fill this out
  }

  clear() {
    // Child class should fill this out
  }

  renderPass() {
    // Child class should fill this out
  }

  reset() {
    this.clear();
  }

  buildCanvas() {
    return intializeCanvas({
      id: this.id,
      canvas: this.canvas,
      startDrawing: (e) => this.surface.startDrawing(e),
      stopDrawing: (e, redraw) => this.surface.stopDrawing(e, redraw),
      clear: () => this.clear(),
      reset: () => this.reset(),
      ...this.canvasModifications(),
    });
  }

  canvasModifications() {
    return {};
  }

  initThreeJS({ uniforms, fragmentShader, renderTargetOverrides, makeRenderTargets, ...rest }) {
    return threeJSInit(
      this.width,
      this.height,
      {
        uniforms,
        fragmentShader,
        vertexShader,
        transparent: false,
      },
      this.renderer,
      renderTargetOverrides ?? {},
      makeRenderTargets,
      rest,
    );
  }
}

class Drawing extends BaseSurface {
  initializeSmoothSurface() {
    const props = this.initThreeJS({
      uniforms: {
        inputTexture: { value: this.surface.texture },
        color: { value: new THREE.Vector4(1, 1, 1, 1) },
        from: { value: new THREE.Vector2(0, 0) },
        to: { value: new THREE.Vector2(0, 0) },
        radiusSquared: { value: Math.pow(this.surface.RADIUS, 2.0) },
        resolution: { value: new THREE.Vector2(this.width, this.height) },
        drawing: { value: false },
        indicator: { value: false },
      },
      fragmentShader: `
uniform sampler2D inputTexture;
uniform vec4 color;
uniform vec2 from;
uniform vec2 to;
uniform float radiusSquared;
uniform vec2 resolution;
uniform bool drawing;
uniform bool indicator;
varying vec2 vUv;

out vec4 FragColor;

void main() {
vec4 current = texture(inputTexture, vUv, 0.0);

FragColor = current;
}`,
    });

    this.surface.drawSmoothLine = () => {
      this.triggerDraw();
    };

    return props;
  }

  triggerDraw() {
    this.renderPass();
  }

  clear() {
    if (this.initialized) {
      this.renderTargets.forEach((target) => {
        this.renderer.setRenderTarget(target);
        this.renderer.clearColor();
      });
    }
    this.renderer.setRenderTarget(null);
    this.renderer.clearColor();
  }

  initialize() {
    const { plane, canvas, render, renderer, renderTargets } = this.initializeSmoothSurface();
    this.canvas = canvas;
    this.plane = plane;
    this.render = render;
    this.renderer = renderer;
    this.renderTargets = renderTargets;
    const { container } = this.buildCanvas();
    this.container = container;
    this.renderIndex = 0;

    this.innerInitialize();
  }

  innerInitialize() {}

  load() {
    this.reset();
    this.initialized = true;
  }

  drawPass() {}

  renderPass() {
    this.drawPass();
    this.renderer.setRenderTarget(null);
    this.render();
  }
}

class DistanceField extends Drawing {
  jfaPassesCount() {
    return this.passes;
  }

  innerInitialize() {
    super.innerInitialize();

    const {
      plane: dfPlane,
      render: dfRender,
      renderTargets: dfRenderTargets,
    } = this.initThreeJS({
      uniforms: {
        surfaceTexture: { value: null },
        time: { value: 0.0 },
      },
      fragmentShader: `
        precision highp float;
          uniform float time;
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
  
            float speed = 1.0 + sin(time);
           // Clamp by the size of our texture (1.0 in uv space).
            float distance = sdCircle(vUv, vec2(0.2, 0.5 + cos(speed + time) * 0.2), 0.05);
  
            if (distance < minDistance) {
              minDistance = distance;
              color.xyz = vec3(0.0, 0.5 + 0.5*cos(speed + time), 1.0); 
            }
  
            distance = sdCircle(vUv, vec2(0.4, 0.5 + cos(speed + (time + PI*0.1)) * 0.2), 0.05);
  
            if (distance < minDistance) {
              minDistance = distance;
              color.xyz = vec3(0.25 + 0.25*sin(speed + (time + PI*0.2)), 0.5 + 0.5*cos(speed + (time + PI*0.1)), 1.0); 
            }
  
            // Add a circle that circles
            distance = sdCircle(vUv, vec2(0.6, 0.5 + cos(speed+(time + PI*0.2)) * 0.2), 0.05);
            if (distance < minDistance) {
              minDistance = distance;
              color.xyz = vec3(0.50 + 0.50*sin(speed + (time + PI*0.4)), 0.5 + 0.5*cos(speed+(time + PI*0.2)), 1.0); 
            }
  
            // One more 
            distance = sdCircle(vUv, vec2(0.8, 0.5 + cos(speed+(time + PI*0.3)) * 0.2), 0.05);
            if (distance < minDistance) {
              minDistance = distance;
              color.xyz = vec3(0.75 + 0.25*sin(speed + (time + PI*0.6)), 0.5 + 0.5*cos(speed+(time + PI*0.3)), 1.0); 
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
          }`,
    });

    this.dfPlane = dfPlane;
    this.dfRender = dfRender;
    this.dfRenderTargets = dfRenderTargets;
  }

  load() {
    this.reset();
    this.initialized = true;
  }

  clear() {
    if (this.initialized) {
      this.dfRenderTargets.forEach((target) => {
        this.renderer.setRenderTarget(target);
        this.renderer.clearColor();
      });
    }
    super.clear();
  }

  dfPass() {
    this.dfPlane.material.uniforms.time.value = performance.now() / 1000.0;
    this.renderer.setRenderTarget(this.dfRenderTargets[0]);
    this.dfRender();
    return this.dfRenderTargets[0].texture;
  }

  renderPass() {
    let out = this.drawPass();
    out = this.dfPass(out);
    this.renderer.setRenderTarget(null);
    this.dfRender();
  }
}

function addSlider({
  id,
  name,
  onUpdate,
  options = {},
  hidden = false,
  initialSpanValue = undefined,
}) {
  const div = document.createElement("div");
  div.style = `display: ${hidden ? "none" : "flex"}; align-items: center; gap: 8px`;
  document.querySelector(`#${id}`).appendChild(div);
  div.append(`${name}`);
  const input = document.createElement("input");
  input.id = `${id}-${name.replace(" ", "-").toLowerCase()}-slider`;
  input.className = "slider";
  input.type = "range";
  Object.entries(options).forEach(([key, value]) => {
    input.setAttribute(key, value);
  });
  if (options.value) {
    input.value = options.value;
  }
  const span = document.createElement("span");
  input.setSpan = (value) => (span.innerText = `${value}`);

  input.addEventListener("input", () => {
    input.setSpan(`${onUpdate(input.value)}`);
  });
  span.innerText = `${input.value}`;
  div.appendChild(input);
  div.appendChild(span);

  input.onUpdate = onUpdate;
  if (initialSpanValue != null) {
    input.setSpan(initialSpanValue);
  }
  return input;
}

class RC extends DistanceField {
  innerInitialize() {
    this.frame = 0;
    this.baseRayCount = 4.0;
    this.reduceDemandCheckbox = document.querySelector("#reduce-demand");
    this.forceFullPass = !this.reduceDemandCheckbox.checked;
    super.innerInitialize();
    this.activelyDrawing = false;
    this.rawBasePixelsBetweenProbes = 1.0;

    this.animating = false;

    this.enableSrgb = document.querySelector("#enable-srgb");
    this.addNoise = document.querySelector("#add-noise");
    this.ringingFix = document.querySelector("#ringing-fix");
    this.sunAngleSlider = { value: 0 };

    this.rayIntervalSlider = addSlider({
      id: "radius-slider-container",
      name: "Interval Length",
      onUpdate: (value) => {
        this.rcPlane.material.uniforms.rayInterval.value = value;
        this.renderPass();
        return value;
      },
      options: { min: 1.0, max: 512.0, step: 1.0, value: 1.0 },
    });

    this.baseRayCountSlider = addSlider({
      id: "radius-slider-container",
      name: "Base Ray Count",
      onUpdate: (value) => {
        this.rcPlane.material.uniforms.baseRayCount.value = Math.pow(4.0, value);
        this.baseRayCount = Math.pow(4.0, value);
        this.renderPass();
        return Math.pow(4.0, value);
      },
      options: { min: 1.0, max: 3.0, step: 1.0, value: 1.0 },
    });

    this.initializeParameters();

    const fragmentShader = document.querySelector("#rc-fragment").innerHTML;

    const {
      plane: rcPlane,
      render: rcRender,
      renderTargets: rcRenderTargets,
    } = this.initThreeJS({
      renderTargetOverrides: {
        minFilter: THREE.LinearMipMapLinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: true,
      },
      uniforms: {
        resolution: { value: new THREE.Vector2(this.width, this.height) },
        sceneTexture: { value: this.surface.texture },
        distanceTexture: { value: null },
        lastTexture: { value: null },
        cascadeExtent: { value: new THREE.Vector2(this.radianceWidth, this.radianceHeight) },
        cascadeCount: { value: this.radianceCascades },
        cascadeIndex: { value: 0.0 },
        basePixelsBetweenProbes: { value: this.basePixelsBetweenProbes },
        cascadeInterval: { value: this.radianceInterval },
        rayInterval: { value: this.rayIntervalSlider.value },
        baseRayCount: { value: Math.pow(4.0, this.baseRayCountSlider.value) },
        sunAngle: { value: this.sunAngleSlider.value },
        time: { value: 0.1 },
        srgb: { value: this.enableSrgb.checked ? 2.2 : 1.0 },
        enableSun: { value: false },
        addNoise: { value: this.addNoise.checked },
        firstCascadeIndex: { value: 0 },
        time: { value: 0.0 },
      },
      fragmentShader,
    });

    this.baseRayCountSlider.setSpan(Math.pow(4.0, this.baseRayCountSlider.value));

    this.firstLayer = this.radianceCascades - 1;
    this.lastLayer = 0;

    this.lastLayerSlider = addSlider({
      id: "radius-slider-container",
      name: "(RC) Layer to Render",
      onUpdate: (value) => {
        this.rcPlane.material.uniforms.firstCascadeIndex.value = value;
        this.lastLayer = value;
        this.renderPass();
        return value;
      },
      options: { min: 0, max: this.radianceCascades - 1, value: 0, step: 1 },
    });

    this.firstLayerSlider = addSlider({
      id: "radius-slider-container",
      name: "(RC) Layer Count",
      onUpdate: (value) => {
        this.rcPlane.material.uniforms.cascadeCount.value = value;
        this.firstLayer = value - 1;
        this.renderPass();
        return value;
      },
      options: { min: 1, max: this.radianceCascades, value: this.radianceCascades, step: 1 },
    });

    this.stage = 3;
    this.stageToRender = addSlider({
      id: "radius-slider-container",
      name: "Stage To Render",
      onUpdate: (value) => {
        this.stage = value;
        this.renderPass();
        return value;
      },
      options: { min: 0, max: 3, value: 3, step: 1 },
    });

    this.pixelsBetweenProbes = addSlider({
      id: "radius-slider-container",
      name: "Pixels Between Base Probe",
      onUpdate: (value) => {
        this.rawBasePixelsBetweenProbes = Math.pow(2, value);
        this.initializeParameters(true);
        this.renderPass();
        return Math.pow(2, value);
      },
      options: { min: 0, max: 4, value: 0, step: 1 },
    });

    const {
      plane: overlayPlane,
      render: overlayRender,
      renderTargets: overlayRenderTargets,
    } = this.initThreeJS({
      uniforms: {
        inputTexture: { value: null },
        drawPassTexture: { value: null },
      },
      fragmentShader: `
          uniform sampler2D inputTexture;
          uniform sampler2D drawPassTexture;
  
          varying vec2 vUv;
          out vec4 FragColor;
  
          void main() {
            vec3 rc = texture(inputTexture, vUv).rgb;
            FragColor = vec4(rc, 1.0);
          }`,
    });

    this.rcPlane = rcPlane;
    this.rcRender = rcRender;
    this.rcRenderTargets = rcRenderTargets;
    this.prev = 0;

    this.overlayPlane = overlayPlane;
    this.overlayRender = overlayRender;
    this.overlayRenderTargets = overlayRenderTargets;
  }

  // Key parameters we care about
  initializeParameters(setUniforms) {
    this.renderWidth = this.width;
    this.renderHeight = this.height;

    // Calculate radiance cascades
    const angularSize = Math.sqrt(
      this.renderWidth * this.renderWidth + this.renderHeight * this.renderHeight,
    );
    this.radianceCascades = Math.ceil(Math.log(angularSize) / Math.log(4)) + 1.0;
    this.basePixelsBetweenProbes = this.rawBasePixelsBetweenProbes;
    this.radianceInterval = 1.0;

    this.radianceWidth = Math.floor(this.renderWidth / this.basePixelsBetweenProbes);
    this.radianceHeight = Math.floor(this.renderHeight / this.basePixelsBetweenProbes);

    if (setUniforms) {
      this.rcPlane.material.uniforms.basePixelsBetweenProbes.value = this.basePixelsBetweenProbes;
      this.rcPlane.material.uniforms.cascadeCount.value = this.radianceCascades;
      this.rcPlane.material.uniforms.cascadeInterval.value = this.radianceInterval;
      this.rcPlane.material.uniforms.cascadeExtent.value = new THREE.Vector2(
        this.radianceWidth,
        this.radianceHeight,
      );
    }
  }

  overlayPass(inputTexture) {
    this.overlayPlane.material.uniforms.drawPassTexture.value = this.drawPassTexture;

    if (this.forceFullPass) {
      this.frame = 0;
    }

    if (this.frame == 0 && !this.forceFullPass) {
      const input = this.overlayRenderTargets[0].texture ?? this.drawPassTexture;
      this.overlayPlane.material.uniforms.inputTexture.value = input;
      this.renderer.setRenderTarget(this.overlayRenderTargets[1]);
      this.overlayRender();
    } else {
      this.overlayPlane.material.uniforms.inputTexture.value = inputTexture;
      this.renderer.setRenderTarget(this.overlayRenderTargets[0]);
      this.overlayRender();
    }

    if (!this.isDrawing) {
      this.overlay = true;
      const frame = this.forceFullPass ? 0 : 1 - this.frame;
      this.plane.material.uniforms.inputTexture.value = this.overlayRenderTargets[frame].texture;
      this.plane.material.uniforms.indicator.value = true;
      this.surface.drawSmoothLine(this.surface.currentPoint, this.surface.currentPoint);
      this.plane.material.uniforms.indicator.value = false;
      this.overlay = false;
    }
  }

  triggerDraw() {
    if (this.overlay) {
      this.renderer.setRenderTarget(null);
      this.render();
      return;
    }
    super.triggerDraw();
  }

  canvasModifications() {
    return {
      startDrawing: (e) => {
        this.surface.startDrawing(e);
      },
      stopDrawing: (e, redraw) => {
        this.surface.stopDrawing(e, redraw);
      },
    };
  }

  rcPass(distanceFieldTexture, drawPassTexture) {
    this.rcPlane.material.uniforms.distanceTexture.value = distanceFieldTexture;
    this.rcPlane.material.uniforms.sceneTexture.value = drawPassTexture;

    if (this.frame == 0) {
      this.rcPlane.material.uniforms.lastTexture.value = null;
    }

    const halfway = Math.floor((this.firstLayer - this.lastLayer) / 2);
    const last = this.frame == 0 && !this.forceFullPass ? halfway + 1 : this.lastLayer;
    this.rcPassCount = this.frame == 0 ? this.firstLayer : halfway;

    for (let i = this.firstLayer; i >= last; i--) {
      this.rcPlane.material.uniforms.cascadeIndex.value = i;

      this.renderer.setRenderTarget(this.rcRenderTargets[this.prev]);
      this.rcRender();
      this.rcPlane.material.uniforms.lastTexture.value = this.rcRenderTargets[this.prev].texture;
      this.prev = 1 - this.prev;
    }

    return this.rcRenderTargets[1 - this.prev].texture;
  }

  doRenderPass() {
    this.rcPlane.material.uniforms.time.value = performance.now() / 1000.0;

    if (this.frame == 0) {
      if (this.stage == 0) {
        this.renderer.setRenderTarget(null);
        this.render();
        this.finishRenderPass();
        return;
      }

      if (this.stage == 1) {
        this.finishRenderPass();
        this.renderer.setRenderTarget(null);
        return;
      }

      this.distanceFieldTexture = this.dfPass(this.drawPassTexture);

      if (this.stage == 2) {
        this.finishRenderPass();
        this.renderer.setRenderTarget(null);
        this.dfRender();
        return;
      }
    }

    let rcTexture = this.rcPass(this.distanceFieldTexture, this.drawPassTexture);

    this.overlayPass(rcTexture);
    this.finishRenderPass();
  }

  finishRenderPass() {
    if (!this.forceFullPass) {
      this.frame = 1 - this.frame;
    }
  }

  // foo bar baz!!
  renderPass() {
    this.drawPassTexture = this.drawPass();
    if (!this.animating) {
      this.animating = true;
      requestAnimationFrame(() => {
        this.animate();
      });
    }
  }

  animate() {
    this.animating = true;

    this.doRenderPass();
    this.desiredRenderPass = false;

    requestAnimationFrame(() => {
      this.animate();
    });
  }

  clear() {
    this.lastFrame = null;
    if (this.initialized) {
      this.rcRenderTargets.forEach((target) => {
        this.renderer.setRenderTarget(target);
        this.renderer.clearColor();
      });
    }
    super.clear();
    this.renderPass();
  }

  //foo bar baz!!
  load() {
    this.reduceDemandCheckbox.addEventListener("input", () => {
      this.forceFullPass = !this.reduceDemandCheckbox.checked;
      this.renderPass();
    });
    this.enableSrgb.addEventListener("input", () => {
      this.rcPlane.material.uniforms.srgb.value = this.enableSrgb.checked ? 2.2 : 1.0;
      this.renderPass();
    });
    this.addNoise.addEventListener("input", () => {
      this.rcPlane.material.uniforms.addNoise.value = this.addNoise.checked;
      this.renderPass();
    });
    this.sunAngleSlider.addEventListener("input", () => {
      this.rcPlane.material.uniforms.sunAngle.value = this.sunAngleSlider.value;
      this.renderPass();
    });
    this.reset();
    this.initialized = true;
  }

  reset() {
    this.clear();
  }
}
// Get all query parameters
const urlParams = new URLSearchParams(window.location.search);

// Get a specific parameter

let [width, height] = [window.innerWidth, window.innerHeight];

new RC({ id: "radiance-cascades-canvas", width, height, radius: 4 });
