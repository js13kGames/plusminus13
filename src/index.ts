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
import WebGLRenderer from "./engine";

// Store mouse position and movement
let cX = window.innerWidth / 2;
let cY = window.innerHeight / 2 + 300;
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

// Usage
const renderer = new WebGLRenderer("glcanvas", window.innerWidth, window.innerHeight);

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
  if (cX > window.innerWidth) cX = 0;
  if (cX < 0) cX = window.innerWidth;
  if (cY > window.innerHeight) cY = 0;
  if (cY < 0) cY = window.innerHeight;
}

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
  // Set the fps of the #fps element
  if (debug) {
    const fps = 1000 / (performance.now() - timeOfRender);
    timeOfRender = performance.now();
    document.getElementById("fps")!.innerText = fps.toFixed(2);
  }

  updateMovement2();

  // Needs to reset, as indicated by gamestate?
  if (needsLevelRestart()) {
    cX = window.innerWidth / 2;
    cY = window.innerHeight / 2;
    moveAngle = 0;
    moveSpeed = 0;
    illumination = 1.0;
    // music.stop();
    music.setNextTempo();
    // music.start();
    shouldlevelRestart(false);
  }

  illumination *= 0.96;

  if (atlasRendered < 2) {
    initBoxes(window.innerWidth, window.innerHeight);
    atlasRendered = atlasRendered + 1;
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

  const speed = Math.sqrt(speedX * speedX + speedY * speedY);
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
  // gl.uniformMatrix4fv(boxesLocation, false, boxesData);

  renderer.render({
    u_super: superMode,
    u_superAvailable: superModeAvailable,
    u_gameStarted: gameStarted ? 1 : 0,
    u_Mouse: [cX, cY, keyState.Space ? 1 : 0, 0],
    u_MouseMove: [moveAngle, speed, illumination, angleLimited],
    u_boxes: boxesData,
  });

  requestAnimationFrame(render);
}

render();
