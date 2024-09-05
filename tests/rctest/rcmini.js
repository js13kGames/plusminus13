function intializeCanvas({ id, canvas, render }) {
  const thisId = document.querySelector(`#${id}`);
  thisId.innerHTML = `
    <div style="display: flex; gap: 20px;">
    <div id="${id}-canvas-container"></div></div>`;
  const container = document.querySelector(`#${id}-canvas-container`);
  container.appendChild(canvas);

  render();

  return { container };
}

const vertexShader = `
varying vec2 vUv;
void main() { 
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

class MyCanvas {
  constructor({ width, height }) {
    this.width = width;
    this.height = height;
  }

  createCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "transparent";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return [canvas, context];
  }

  // setupTexture(texture) {
  //   texture.minFilter = THREE.NearestFilter;
  //   texture.magFilter = THREE.NearestFilter;
  //   texture.format = THREE.RGBAFormat;
  //   texture.type = true ? THREE.HalfFloatType : THREE.FloatType;
  //   texture.wrapS = THREE.ClampToEdgeWrapping;
  //   texture.wrapT = THREE.ClampToEdgeWrapping;
  //   texture.generateMipmaps = true;
  // }

  updateTexture() {
    this.texture.needsUpdate = true;
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
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
    // Create MyCanvas instances
    this.createSurface(width, height, radius);
    this.dpr = dpr || window.devicePixelRatio || 1;
    this.width = width;
    this.height = height;
    this.id = id;
    this.initialized = false;
    this.initialize();
  }

  createSurface(width, height, radius) {
    this.surface = new MyCanvas({ width, height, radius });
  }

  reset() {
    this.clear();
  }

  buildCanvas() {
    return intializeCanvas({
      id: this.id,
      canvas: this.canvas,
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

class DistanceField extends BaseSurface {
  initializeSmoothSurface() {
    const props = this.initThreeJS({
      uniforms: {
        inputTexture: { value: this.surface.texture },
      },
      fragmentShader: `
uniform sampler2D inputTexture;
varying vec2 vUv;

out vec4 FragColor;

void main() {
vec4 current = texture(inputTexture, vUv, 0.0);

FragColor = current;
}`,
    });
    this.surface.render = () => {
      this.renderPass();
    };

    return props;
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

  innerInitialize() {
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
           float minDist = 999999.9;
            vec4 color = vec4(0.0);
  
            float speed = 1.0 + sin(time);
           // Clamp by the size of our texture (1.0 in uv space).
            float distance = sdCircle(vUv, vec2(0.2, 0.5 + cos(time) * 0.2), 0.02);
  
            if (distance < minDist) {
              minDist = distance;
              color.xyz = vec3(1.0, 1.0, 1.0); 
            }
  
            // distance = sdCircle(vUv, vec2(0.4, 0.5 + cos(speed + (time + PI*0.1)) * 0.2), 0.05);
  
            // if (distance < minDist) {
            //   minDist = distance;
            //   color.xyz = vec3(0.25 + 0.25*sin(speed + (time + PI*0.2)), 0.5 + 0.5*cos(speed + (time + PI*0.1)), 1.0); 
            // }
  
            // // Add a circle that circles
            // distance = sdCircle(vUv, vec2(0.6, 0.5 + cos(speed+(time + PI*0.2)) * 0.2), 0.05);
            // if (distance < minDist) {
            //   minDist = distance;
            //   color.xyz = vec3(0.50 + 0.50*sin(speed + (time + PI*0.4)), 0.5 + 0.5*cos(speed+(time + PI*0.2)), 1.0); 
            // }
  
            // // One more 
            // distance = sdCircle(vUv, vec2(0.8, 0.5 + cos(speed+(time + PI*0.3)) * 0.2), 0.05);
            // if (distance < minDist) {
            //   minDist = distance;
            //   color.xyz = vec3(0.75 + 0.25*sin(speed + (time + PI*0.6)), 0.5 + 0.5*cos(speed+(time + PI*0.3)), 1.0); 
            // }
  
            // Add a fixed capsule
            distance = sdCapsule(vUv, vec2(0.5, 0.5), vec2(0.5, 0.7), 0.02);
            if (distance < minDist) {
              minDist = distance;
              color.xyz = vec3(0.0, 0.0, 0.0); 
            }
  
            // // Add a fixed capsule
            // distance = sdCapsule(vUv, vec2(0.3, 0.2), vec2(0.3, 0.4), 0.02);
            // if (distance < minDist) {
            //   minDist = distance;
            //   color.xyz = vec3(0.0, 0.0, 0.0); 
            // }
  
            // // Add a fixed capsule
            // distance = sdCapsule(vUv, vec2(0.7, 0.2), vec2(0.7, 0.4), 0.02);
            // if (distance < minDist) {
            //   minDist = distance;
            //   color.xyz = vec3(0.0, 0.0, 0.0); 
            // }
            minDist = clamp(minDist, 0.0, 1.0);    
  
        
            // Normalize and visualize the distance
            FragColor = vec4(minDist, color.xyz);


          }`,
    });

    this.dfPlane = dfPlane;
    this.dfRender = dfRender;
    this.dfRenderTargets = dfRenderTargets;
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
}

class RC extends DistanceField {
  innerInitialize() {
    this.frame = 0;
    this.baseRayCount = 4.0;
    this.reduceDemandCheckbox = document.querySelector("#reduce-demand");
    this.forceFullPass = true;
    super.innerInitialize();
    this.activelyDrawing = false;
    this.rawBasePixelsBetweenProbes = 2.0;
    this.animating = false;
    this.sunAngleSlider = { value: 0 };

    // Uniform parameters
    const rayInterval = 2.0;
    const baseRayCount = 1.0; // max 3.0, step 1.0
    const srgb = 1.0;

    this.baseRayCount = Math.pow(4.0, baseRayCount);

    this.initializeParameters();

    const fragmentShader = document.querySelector("#rc-fragment2").innerHTML;

    const {
      plane: rcPlane,
      render: rcRender,
      renderTargets: rcRenderTargets,
    } = this.initThreeJS({
      renderTargetOverrides: {
        minFilter: THREE.LinearMipmapLinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: true,
      },
      uniforms: {
        resolution: { value: new THREE.Vector2(this.width, this.height) },
        sceneTexture: { value: this.surface.texture },
        distanceTexture: { value: null },
        lastTexture: { value: null },
        cascadeExtent: { value: new THREE.Vector2(this.radianceWidth, this.radianceHeight) },
        cascadeCount: { value: this.radianceCascades }, // min 1, max this.radianceCascades, step 1
        cascadeIndex: { value: 0.0 },
        basePixelsBetweenProbes: { value: this.basePixelsBetweenProbes },
        cascadeInterval: { value: this.radianceInterval },
        rayInterval: { value: rayInterval },
        baseRayCount: { value: Math.pow(4.0, baseRayCount) },
        sunAngle: { value: this.sunAngleSlider.value },
        time: { value: 0.1 },
        srgb: { value: srgb ? 2.2 : 1.0 },
        enableSun: { value: false },
        addNoise: { value: false },
        firstCascadeIndex: { value: 0 }, // max = this.radianceCascades - 1, step 1
        time: { value: 0.0 },
      },
      fragmentShader,
    });

    this.firstLayer = this.radianceCascades - 1;
    this.lastLayer = 0;

    this.stage = 3; // min 1 max 3 step 1
    // this.rawBasePixelsBetweenProbes = 0.0; // min 0 max 4 step 1

    this.rcPlane = rcPlane;
    this.rcRender = rcRender;
    this.rcRenderTargets = rcRenderTargets;
    this.prev = 0;
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

  canvasModifications() {
    return {
      render: (e) => {
        this.renderPass();
      },
    };
  }

  rcPass(distanceFieldTexture) {
    this.rcPlane.material.uniforms.distanceTexture.value = distanceFieldTexture;

    if (this.frame == 0) {
      this.rcPlane.material.uniforms.lastTexture.value = null;
    }

    const halfway = Math.floor((this.firstLayer - this.lastLayer) / 2);
    const last = this.frame == 0 && !this.forceFullPass ? halfway + 1 : this.lastLayer;
    this.rcPassCount = this.frame == 0 ? this.firstLayer : halfway;

    for (let i = this.firstLayer; i >= last; i--) {
      this.rcPlane.material.uniforms.cascadeIndex.value = i;

      if (i == last) {
        this.renderer.setRenderTarget(null);
      } else {
        this.renderer.setRenderTarget(this.rcRenderTargets[this.prev]);
      }

      this.rcRender();
      this.rcPlane.material.uniforms.lastTexture.value = this.rcRenderTargets[this.prev].texture;

      this.prev = 1 - this.prev;
    }

    return this.rcRenderTargets[1 - this.prev].texture;
  }

  doRenderPass() {
    this.rcPlane.material.uniforms.time.value = performance.now() / 1000.0;

    this.distanceFieldTexture = this.dfPass();
    this.rcPass(this.distanceFieldTexture);
  }

  renderPass() {
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

}

let [width, height] = [window.innerWidth, window.innerHeight];
new RC({ id: "radiance-cascades-canvas", width, height, radius: 4 });
