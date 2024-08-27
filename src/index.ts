import bufferBShaderSrc from "./shaders/bufferB.fragment.glsl";
import cubeAShaderSrc from "./shaders/cubeMap.fragment.glsl";
import imageShaderSrc from "./shaders/image.fragment.glsl";
import geometricsdffont from "./shaders/geometricsdffont.fragment.glsl";
import {
  boxes,
  initBoxes,
  update,
  superMode,
  superModeAvailable,
  gameStarted,
  startGame,
  needsLevelRestart,
  shouldlevelRestart,
  onGameStop,
} from "./gamestate";
import Music from "./music2";
import { playRandomSound, playSound } from "./sound";

const canvas = <HTMLCanvasElement>document.getElementById("glcanvas");
if (!canvas) {
  throw new Error("No canvas found");
}
const gl = canvas.getContext("webgl2");
if (!gl) {
  throw new Error("No WebGL2 context found");
}

// const mFloat32Textures = true;
gl.getExtension("OES_texture_float_linear");
gl.getExtension("OES_texture_half_float_linear");
gl.getExtension("EXT_color_buffer_float");
// const mDebugShader = gl.getExtension("WEBGL_debug_shaders");
const mAsynchCompile = gl.getExtension("KHR_parallel_shader_compile");

// Set the canvas size
canvas.width = window.innerWidth; // Set canvas width to window width
canvas.height = window.innerHeight; // Set canvas height to window height

const mGl = {
  TEXTURE_2D: 0,
  TEXTURE_CUBE_MAP: 1,
};

const CUBEMAP_RES = 1024;

const cubemapBuffer = {
  textures: [null, null], // 2 elements
  targets: [null, null], // 2 elements
  lastRenderDone: 0,
};

const bufferA = {
  textures: [null, null], // 2 elements
  targets: [null, null], // 2 elements
  lastRenderDone: 0,
};

const bufferB = {
  textures: [null, null], // 2 elements
  targets: [null, null], // 2 elements
  lastRenderDone: 0,
};

const geomtricSdfBuffer = {
  textures: [null, null], // 2 elements
  targets: [null, null], // 2 elements
  lastRenderDone: 0,
};

resizeBuffer(gl, bufferA);
resizeBuffer(gl, bufferB);
resizeBuffer(gl, geomtricSdfBuffer);
resizeCubemapBuffer(gl, cubemapBuffer);

function resizeCanvas() {
  // Set the canvas size to match the new window size
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Recreate the textures for each framebuffer
  gl && resizeBuffer(gl, bufferA);
  gl && resizeBuffer(gl, bufferB);
  // Cubemap is fixed size
  // resizeCubemapBuffer(gl, cubemapBuffer);

  // Update the WebGL viewport to match the new canvas size
  gl && gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener("resize", resizeCanvas);

// Store mouse position and movement
let cX = canvas.width / 2;
let cY = canvas.height / 2 + 300;
let moveAngle = 0;
let moveSpeed = 0.0;
let speedX = 0.0;
let speedY = 0.0;
let moveAccel = 0.05;
let maxSpeed = 5.0;
const friction = 0.99;
const rotationSpeed = 0.03;
const previousSpeedX = 0.0;
const previousSpeedY = 0.0;
const lateralGForce = 0.0;
const forwardGForce = 0.0;
const visualRotation = 0.0;
const visualRotationSpeed = 0.1;
let maxBackwardSpeed = -5;
let illumination = 0.0;
let angleLimited = 0;
let musicStarted = 0;

let music: Music;
const start = () => {
  startGame();
  document.querySelector("#start")?.setAttribute("style", "display: none");
  document.getElementById("game-ui")?.setAttribute("style", "display: flex");
  document.getElementById("over")?.setAttribute("style", "display: none");
  if (!musicStarted) {
    music = new Music();
    music.start();
    musicStarted = 1;
  }
  playSound(0);
};

onGameStop(() => {
  if (musicStarted) {
    music.stop();
    musicStarted = 0;
  }
  document.getElementById("game-ui")?.setAttribute("style", "display: none");
  document.getElementById("restart")?.addEventListener("click", () => {
    start();
  });
});

document.querySelector("#start button")?.addEventListener("click", () => {
  start();
});

// Add keyboard controls, that move the character via the moveX, moveY, cX, cY
const keyState: { [key: string]: boolean } = {
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  w: false,
  s: false,
  a: false,
  d: false,
  Space: false,
};

window.addEventListener("keydown", (event) => {
  keyState[event.code] = true;

  // Start game if Return key is pressed, but only if the Start button is visible
  if (
    event.code === "Enter" &&
    !gameStarted &&
    document.querySelector("#start")?.getAttribute("style") !== "display: none"
  ) {
    start();
  }
});

window.addEventListener("keyup", (event) => {
  keyState[event.code] = false;
});

function calculateInertiaDeflectionAngle(ax: number, ay: number) {
  // Calculate the angle of deflection based on the acceleration vector
  let angle = Math.atan2(ax, ay);

  // Convert the angle to a range of -PI to PI non-linearly
  if (Math.abs(angle) > Math.PI / 1.1) {
    angle = 0;
    angleLimited = Math.min(angleLimited + 0.1, 1);
  } else {
    angleLimited = Math.max(angleLimited - 0.1, 0);
  }

  angle = angle / 1.8;

  // Smooth the angle change
  const angleDiff = angle - moveAngle;
  // if (angleDiff > Math.PI) {
  //   moveAngle += Math.PI * 2;
  // } else if (angleDiff < -Math.PI) {
  //   moveAngle -= Math.PI * 2;
  // }
  moveAngle += angleDiff * 0.1;
  return moveAngle;
  // return angle;
}

function updateMovement2() {
  // Set acceleration and speed limits based on "super mode"
  if (keyState.Space) {
    maxSpeed = 10.0;
    moveAccel = 0.6;
    maxBackwardSpeed = -10;
  } else {
    maxSpeed = 5.0;
    moveAccel = 0.3;
    maxBackwardSpeed = -5;
  }
  let targetDx = 0;
  let targetDy = 0;

  const friction = 0.96; // Friction factor (0-1)

  // Determine target movement direction based on key presses
  if (keyState.ArrowUp || keyState.KeyW) targetDy += 1;
  if (keyState.ArrowDown || keyState.KeyS) targetDy -= 1;
  if (keyState.ArrowLeft || keyState.KeyA) targetDx -= 1;
  if (keyState.ArrowRight || keyState.KeyD) targetDx += 1;

  // Normalize diagonal movement
  if (targetDx !== 0 && targetDy !== 0) {
    const magnitude = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
    targetDx /= magnitude;
    targetDy /= magnitude;
  }

  moveAngle = calculateInertiaDeflectionAngle(targetDx * moveAccel, targetDy * moveAccel);
  // Apply acceleration towards the target direction
  speedX += targetDx * moveAccel;
  speedY += targetDy * moveAccel;

  // Apply friction
  speedX *= friction;
  speedY *= friction;

  // Limit speed to maxSpeed
  const currentSpeed = Math.sqrt(speedX * speedX + speedY * speedY);
  if (currentSpeed > maxSpeed) {
    const scaleFactor = maxSpeed / currentSpeed;
    speedX *= scaleFactor;
    speedY *= scaleFactor;
  }

  // Update position
  cX += speedX;
  cY += speedY;

  // Screen wrapping
  if (cX > canvas.width) cX = 0;
  if (cX < 0) cX = canvas.width;
  if (cY > canvas.height) cY = 0;
  if (cY < 0) cY = canvas.height;
}

function resizeBuffer(gl: WebGL2RenderingContext, fbObj: any) {
  const width = gl.canvas.width;
  const height = gl.canvas.height;

  // Resize textures[1] and [2] to match the new canvas size
  const texture1 = createTexture(gl, width, height);
  const texture2 = createTexture(gl, width, height);

  const target1 = createRenderTarget(texture1);
  const target2 = createRenderTarget(texture2);

  fbObj.textures = [texture1, texture2];
  fbObj.targets = [target1, target2];
}

function resizeCubemapBuffer(gl: WebGL2RenderingContext, fbObj: any) {
  const width = CUBEMAP_RES;
  const height = CUBEMAP_RES;

  // Resize textures[1] and [2] to match the new canvas size
  const texture1 = createTexture(gl, width, height, mGl.TEXTURE_CUBE_MAP);
  const texture2 = createTexture(gl, width, height, mGl.TEXTURE_CUBE_MAP);

  const target1 = createRenderTargetCubemap(texture1);
  const target2 = createRenderTargetCubemap(texture2);

  fbObj.textures = [texture1, texture2];
  fbObj.targets = [target1, target2];
}

function createTexture(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  type = mGl.TEXTURE_2D,
) {
  const texture = gl.createTexture();
  if (type == mGl.TEXTURE_2D) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  } else if (type == mGl.TEXTURE_CUBE_MAP) {
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
    width = 1024; // fixed
    height = 1024; // fixed
    for (let i = 0; i < 6; i++) {
      gl.texImage2D(
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
        0,
        gl.RGBA16F,
        width,
        height,
        0,
        gl.RGBA,
        gl.FLOAT,
        null,
      );
    }
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
  }
  return texture;
}

// const bufferAShaderSrc = `#version 300 es
// precision highp float;
// uniform sampler2D iChannel0;
// uniform vec2 resolution;
// out vec4 fragColor;
// ${commonShaderSrc}
// void main() {
//     vec2 uv = gl_FragCoord.xy / resolution.xy;
//     vec4 color = texture(iChannel0, uv);
//     // Buffer A logic
//     fragColor = color;
// }
// `;

const vertexShaderSrc = `#version 300 es
in vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

let bufferATextureIndex = 0;
let bufferBTextureIndex = 0;
let cubeATextureIndex = 0;
let geometricSdfTextureIndex = 0;

// Setup WebGL and create shaders for each buffer
// const commonShader = createShader(gl, gl.FRAGMENT_SHADER, commonShaderSrc);
// const bufferAShader = createShader(gl, gl.FRAGMENT_SHADER, bufferAShaderSrc);
const bufferBShader = createShader(gl, gl.FRAGMENT_SHADER, bufferBShaderSrc);
const cubeAShader = createShader(gl, gl.FRAGMENT_SHADER, cubeAShaderSrc);
const imageShader = createShader(gl, gl.FRAGMENT_SHADER, imageShaderSrc);
const geometricSDFShader = createShader(gl, gl.FRAGMENT_SHADER, geometricsdffont);

// const shaderProgram = createProgram(gl, vertexShaderSrc, commonShaderSrc);
// const bufferAProgram = createProgram(gl, vertexShaderSrc, bufferAShaderSrc);
const bufferBProgram = createProgram(gl, vertexShaderSrc, bufferBShaderSrc);
const cubeAProgram = createProgram(gl, vertexShaderSrc, cubeAShaderSrc);
const imageProgram = createProgram(gl, vertexShaderSrc, imageShaderSrc);
const geometricSDFProgram = createProgram(gl, vertexShaderSrc, geometricsdffont);

const setRenderTarget = (fbo: any) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbId);
};

const setRenderTargetCubeMap = function (fbo: any, face: number) {
  if (fbo === null) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbId);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
      fbo.colorTexture,
      0,
    );
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X+face, fbo.mTex0.mObjectID, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      console.error("Framebuffer not complete");
    }
  }
};
const renderCubemap = (face: number) => {
  gl.viewport(0, 0, CUBEMAP_RES, CUBEMAP_RES);

  let corA = [-1.0, -1.0, -1.0];
  let corB = [1.0, -1.0, -1.0];
  let corC = [1.0, 1.0, -1.0];
  let corD = [-1.0, 1.0, -1.0];
  const apex = [0.0, 0.0, 0.0];

  if (face === 0) {
    corA = [1.0, 1.0, 1.0];
    corB = [1.0, 1.0, -1.0];
    corC = [1.0, -1.0, -1.0];
    corD = [1.0, -1.0, 1.0];
  } else if (face === 1) {
    corA = [-1.0, 1.0, -1.0];
    corB = [-1.0, 1.0, 1.0];
    corC = [-1.0, -1.0, 1.0];
    corD = [-1.0, -1.0, -1.0];
  } else if (face === 2) {
    corA = [-1.0, 1.0, -1.0];
    corB = [1.0, 1.0, -1.0];
    corC = [1.0, 1.0, 1.0];
    corD = [-1.0, 1.0, 1.0];
  } else if (face === 3) {
    corA = [-1.0, -1.0, 1.0];
    corB = [1.0, -1.0, 1.0];
    corC = [1.0, -1.0, -1.0];
    corD = [-1.0, -1.0, -1.0];
  } else if (face === 4) {
    corA = [-1.0, 1.0, 1.0];
    corB = [1.0, 1.0, 1.0];
    corC = [1.0, -1.0, 1.0];
    corD = [-1.0, -1.0, 1.0];
  } else if (face === 5) {
    corA = [1.0, 1.0, -1.0];
    corB = [-1.0, 1.0, -1.0];
    corC = [-1.0, -1.0, -1.0];
    corD = [1.0, -1.0, -1.0];
  }

  const corners = [
    corA[0],
    corA[1],
    corA[2],
    corB[0],
    corB[1],
    corB[2],
    corC[0],
    corC[1],
    corC[2],
    corD[0],
    corD[1],
    corD[2],

    apex[0],
    apex[1],
    apex[2],
  ];

  if (!cubeAProgram) return;
  // In pure WebGL, you would set the uniforms like this:
  const cornersLocation = gl.getUniformLocation(cubeAProgram, "unCorners");
  gl.uniform3fv(cornersLocation, corners);
  // And the same for the viewport
  const viewportLocation = gl.getUniformLocation(cubeAProgram, "unViewport");
  gl.uniform4fv(viewportLocation, [0, 0, CUBEMAP_RES, CUBEMAP_RES]);

  // Draw the quad
  drawQuad(gl);
};

// Exit fullscreen on escape key
// document.addEventListener("keydown", (event) => {
//   if (event.key === "Escape") {
//     document.exitFullscreen();
//   }
// });

const debug = window.location.search.includes("debug");
// const sdfRenderer = new TinySDFRenderer();
// const atlas = sdfRenderer.render(["A", "B", "C", "D", "1", "3", "L", "T"]);
// Render geometric SDF to a float texture

// Create the render loop
let atlasRendered = 0; // Flag to track if the atlas has been rendered
const sdfTexture = null; // Variable to store the SDF texture

// function normalize(vec: number[]) {
//   const length = Math.hypot(vec[0], vec[1]);
//   return [vec[0] / length, vec[1] / length];
// }
// function lerpDirection(currentDir: number[], targetDir: number[], t: number) {
//   const interpolated = [
//     currentDir[0] * (1 - t) + targetDir[0] * t,
//     currentDir[1] * (1 - t) + targetDir[1] * t,
//   ];
//   return normalize(interpolated);
// }

let timeOfRender = performance.now();

function render() {
  if (!gl) return;
  if (!bufferBProgram || !cubeAProgram || !imageProgram || !geometricSDFProgram) return;

  // Set the fps of the #fps element
  if (debug) {
    const fps = 1000 / (performance.now() - timeOfRender);
    timeOfRender = performance.now();
    document.getElementById("fps")!.innerText = fps.toFixed(2);
  }

  updateMovement2();

  // Needs to reset, as indicated by gamestate?
  if (needsLevelRestart()) {
    cX = canvas.width / 2;
    cY = canvas.height / 2;
    moveAngle = 0;
    moveSpeed = 0;
    illumination = 1.0;
    // music.stop();
    music.setNextTempo();
    // music.start();
    shouldlevelRestart(false);
  }

  illumination *= 0.96;
  // Toggle between the two textures
  bufferATextureIndex = 1 - bufferATextureIndex;
  bufferBTextureIndex = 1 - bufferBTextureIndex;
  cubeATextureIndex = 1 - cubeATextureIndex;
  geometricSdfTextureIndex = 0; // 1 - geometricSdfTextureIndex;

  // Render to Buffer A
  //   setRenderTarget(bufferA.targets[bufferATextureIndex]); // Ensure framebuffer is bound
  // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, bufferA.textures[bufferATextureIndex], 0);  // Attach the texture

  // Use the other texture as input
  //   gl.activeTexture(gl.TEXTURE0);
  //   gl.bindTexture(gl.TEXTURE_2D, bufferA.textures[1 - bufferATextureIndex]);

  //   useShader(gl, bufferAProgram);
  //   drawQuad(gl);
  if (atlasRendered < 1) {
    initBoxes(canvas.width, canvas.height);
  }
  update(
    performance.now(),
    document.getElementById("timer")!,
    document.getElementById("score")!,
    document.getElementById("lives")!,
    document.getElementById("over")!,
    cX,
    cY,
    visualRotation + moveAngle, // the rotation of the character
    keyState.Space ? true : false,
  );

  if (atlasRendered < 2) {
    console.log(mAsynchCompile);
    setRenderTarget(geomtricSdfBuffer.targets[geometricSdfTextureIndex]); // Ensure framebuffer is bound
    // gl.framebufferTexture2D(
    //   gl.FRAMEBUFFER,
    //   gl.COLOR_ATTACHMENT0,
    //   gl.TEXTURE_2D,
    //   geomtricSdfBuffer.textures[geometricSdfTextureIndex],
    //   0,
    // );

    useShader(gl, geometricSDFProgram);
    drawQuad(gl);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    atlasRendered += 1;
  }

  // Render to Buffer B
  setRenderTarget(bufferB.targets[bufferBTextureIndex]); // Ensure framebuffer is bound

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, geomtricSdfBuffer.textures[geometricSdfTextureIndex]);

  useShader(gl, bufferBProgram);

  gl.uniform1i(gl.getUniformLocation(bufferBProgram, "iChannel0"), 0);

  gl.uniform1f(gl.getUniformLocation(bufferBProgram, "u_super"), superMode);
  gl.uniform1f(gl.getUniformLocation(bufferBProgram, "u_superAvailable"), superModeAvailable);

  // Game started?
  gl.uniform1f(gl.getUniformLocation(bufferBProgram, "u_gameStarted"), gameStarted ? 1 : 0);

  const mouseLocation = gl.getUniformLocation(bufferBProgram, "iMouse");
  gl.uniform4f(mouseLocation, cX, cY, keyState.Space ? 1 : 0, 0);

  const mouseMoveLocation = gl.getUniformLocation(bufferBProgram, "iMouseMove");
  const speed = Math.sqrt(speedX * speedX + speedY * speedY);
  gl.uniform4f(mouseMoveLocation, moveAngle, speed, illumination, angleLimited);

  const boxesLocation = gl.getUniformLocation(bufferBProgram, "u_boxes");
  // the uniform is: uniform mat4 u_boxes[13]
  const boxesData = new Float32Array(13 * 16);
  for (let i = 0; i < 13; i++) {
    const box = boxes[i];
    const offset = i * 16;
    boxesData[offset] = box.x; // 1st row
    boxesData[offset + 1] = box.y;
    boxesData[offset + 2] = box.size;
    boxesData[offset + 3] = box.value;
    boxesData[offset + 4] = box.dx; // 2nd row
    boxesData[offset + 5] = box.dy;
    boxesData[offset + 6] = box.enemy;
    boxesData[offset + 7] = box.radiance; // pad
    boxesData[offset + 8] = box.r; // 3rd row
    boxesData[offset + 9] = box.g;
    boxesData[offset + 10] = box.b;
  }
  gl.uniformMatrix4fv(boxesLocation, false, boxesData);
  drawQuad(gl);

  // Render to Cubemap
  useShader(gl, cubeAProgram);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapBuffer.textures[1 - cubeATextureIndex]);
  const samplerLocationCube = gl.getUniformLocation(cubeAProgram, "iChannel0");
  gl.uniform1i(samplerLocationCube, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, bufferB.textures[1 - bufferBTextureIndex]);
  const samplerLocation = gl.getUniformLocation(cubeAProgram, "iChannel1");
  gl.uniform1i(samplerLocation, 1);

  for (let face = 0; face < 6; face++) {
    setRenderTargetCubeMap(cubemapBuffer.targets[cubeATextureIndex], face); // Ensure framebuffer is bound
    renderCubemap(face);
    // this.Paint_Cubemap( vrData, wa, da, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, buffers, cubeBuffers, keyboard, face );
  }
  setRenderTargetCubeMap(null, 0);

  // Render final Image to the screen
  bindFramebuffer(gl, null); // Render to the screen (null unbinds the framebuffer)
  useShader(gl, imageProgram);

  // Bind the output textures from the buffers as input for the final image
  // gl.activeTexture(gl.TEXTURE1);
  // gl.bindTexture(gl.TEXTURE_2D, bufferB.textures[bufferATextureIndex]);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, bufferB.textures[bufferBTextureIndex]);

  const samplerLocation1 = gl.getUniformLocation(imageProgram, "iChannel1");
  gl.uniform1i(samplerLocation1, 1);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubemapBuffer.textures[cubeATextureIndex]);

  const samplerLocationCube1 = gl.getUniformLocation(imageProgram, "iChannel0");
  gl.uniform1i(samplerLocationCube1, 0);

  drawQuad(gl);

  requestAnimationFrame(render);
}

render();

// Utility functions to create shaders, framebuffers, etc.
function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) {
    console.error("Failed to create shader.");
    return null;
  }
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

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShaderSource: string,
  fragmentShaderSource: string,
) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

  if (!vertexShader || !fragmentShader) {
    console.error("Failed to compile shaders.");
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    console.error("Failed to create program.");
    return null;
  }
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

function createRenderTarget(colorTexture: any) {
  if (!gl) return null;
  const fbId = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbId);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return {
    fbId,
    colorTexture: colorTexture,
  };
}

function createRenderTargetCubemap(colorTexture: any) {
  if (!gl) {
    return null;
  }
  const fbId = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbId);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    colorTexture,
    0,
  );
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

function bindFramebuffer(gl: WebGL2RenderingContext, framebuffer: any) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer ? framebuffer.framebuffer : null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
}

function useShader(gl: WebGL2RenderingContext, shader: WebGLShader) {
  gl.useProgram(shader);
  // Set shader uniforms here, like time, resolution, etc.
  // Set resolution uniform
  const resolutionLocation = gl.getUniformLocation(shader, "resolution");
  gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(gl.getUniformLocation(shader, "iTime"), performance.now() / 1000);
}

function drawQuad(gl: WebGL2RenderingContext) {
  const vertices = new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]);

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  if (!bufferBProgram) {
    console.error("No bufferAProgram");
    return;
  }
  const position = gl.getAttribLocation(bufferBProgram, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
