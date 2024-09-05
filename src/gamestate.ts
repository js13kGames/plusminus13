import { displayHighScores, storeHighScore } from "./highscore";
import { playSound } from "./sound";

let score = 0;
let lives = 3;
let timeLeft = 1300; // 13 seconds in 1/100ths of a second
export let wave = 1;
let avoid13 = true;
let lastTime = 0;
export let tempInvincibility = 1.0;
interface Box {
  x: number;
  y: number;
  size: number;
  value: number;
  dx: number;
  dy: number;
  enemy: number;
  r: number;
  g: number;
  b: number;
  collision: boolean;
  radiance: number;
}

export const boxes: Box[] = [];
export let superMode = 0;
export let superModeAvailable = 1;
export let gameStarted = false;
let levelRestart = false;

export function shouldlevelRestart(is: boolean) {
  levelRestart = is;
}
export function needsLevelRestart() {
  return levelRestart;
}

export function setTempInvincibility(n: number) {
  tempInvincibility = n;
}

// Draw the body box
const canvasEl = document.getElementById("dcanvas") as HTMLCanvasElement;
const ctx = canvasEl.getContext("2d") as CanvasRenderingContext2D;
// Draw some text on the canvas
canvasEl.width = window.innerWidth;
canvasEl.height = window.innerHeight;

export function startGame() {
  timeLeft = 1300;
  wave = 1;
  avoid13 = true;
  initBoxes(gameWidth, gameHeight);
  lives = 3;
  gameStarted = true;
  lastTime = performance.now();
  superMode = 0;
  // shouldlevelRestart(true);
  //   initBoxes(gameWidth, gameHeight);
  score = 0;
}

// Helper function to rotate a point around an origin
function rotatePoint(x: number, y: number, originX: number, originY: number, angle: number) {
  const sinAngle = Math.sin(angle);
  const cosAngle = Math.cos(angle);
  const dx = x - originX;
  const dy = y - originY;
  return {
    x: originX + dx * cosAngle - dy * sinAngle,
    y: originY + dx * sinAngle + dy * cosAngle,
  };
}
function projectOntoAxis(corners: { x: number; y: number }[], axis: { x: number; y: number }) {
  let min = Infinity;
  let max = -Infinity;
  for (const corner of corners) {
    const projection = corner.x * axis.x + corner.y * axis.y;
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return { min, max };
}

function getBodyBoxCorners(
  bodyBox: { width: number; height: number },
  posX: number,
  posY: number,
  rotation: number,
) {
  const halfWidth = bodyBox.width / 2;
  // const halfHeight = bodyBox.height / 2;

  const bodyRatio = 0.1;
  const corners = [
    rotatePoint(posX - halfWidth, posY - (1 - bodyRatio) * bodyBox.height, posX, posY, rotation), // top-left
    rotatePoint(posX + halfWidth, posY - (1 - bodyRatio) * bodyBox.height, posX, posY, rotation), // top-right
    rotatePoint(posX + halfWidth, posY + bodyRatio * bodyBox.height, posX, posY, rotation), // bottom-right
    rotatePoint(posX - halfWidth, posY + bodyRatio * bodyBox.height, posX, posY, rotation), // bottom-left
  ];

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.fillText("Hello, World!", 10, 50);

  ctx.beginPath();
  ctx.moveTo(corners[0].x, gameHeight - corners[0].y);
  ctx.lineTo(corners[1].x, gameHeight - corners[1].y);
  ctx.lineTo(corners[2].x, gameHeight - corners[2].y);
  ctx.lineTo(corners[3].x, gameHeight - corners[3].y);
  ctx.closePath();
  ctx.stroke();
  // We need to flip the y-axis to match the canvas coordinates

  return corners;
}

function getNormals(corners: { x: number; y: number }[]) {
  const normals = [];
  for (let i = 0; i < corners.length; i++) {
    const current = corners[i];
    const next = corners[(i + 1) % corners.length];
    const edge = { x: next.x - current.x, y: next.y - current.y };
    normals.push({ x: -edge.y, y: edge.x });
  }
  return normals;
}

function checkCollision(
  bodyBox: { width: number; height: number },
  box: { x: number; y: number; size: number },
  mouseX: number,
  mouseY: number,
  rotation: number,
) {
  const bodyBoxCorners = getBodyBoxCorners(bodyBox, mouseX, mouseY, rotation);
  const boxCorners = [
    { x: box.x - box.size / 2, y: box.y - box.size / 2 },
    { x: box.x + box.size / 2, y: box.y - box.size / 2 },
    { x: box.x + box.size / 2, y: box.y + box.size / 2 },
    { x: box.x - box.size / 2, y: box.y + box.size / 2 },
  ];

  const allNormals = [...getNormals(bodyBoxCorners), ...getNormals(boxCorners)];

  for (const normal of allNormals) {
    const bodyBoxProjection = projectOntoAxis(bodyBoxCorners, normal);
    const boxProjection = projectOntoAxis(boxCorners, normal);

    if (bodyBoxProjection.max < boxProjection.min || boxProjection.max < bodyBoxProjection.min) {
      return false; // Separation found, no collision
    }
  }

  return true; // No separation found, collision detected
}

function checkCollisionBox(box1: Box, box2: Box) {
  return (
    box1.x - box1.size / 2 < box2.x + box2.size / 2 &&
    box1.x + box1.size / 2 > box2.x - box2.size / 2 &&
    box1.y - box1.size / 2 < box2.y + box2.size / 2 &&
    box1.y + box1.size / 2 > box2.y - box2.size / 2
  );
}

function resolveCollision(box1: Box, box2: Box) {
  // Calculate collision normal
  const nx = box2.x - box1.x;
  const ny = box2.y - box1.y;
  const len = Math.sqrt(nx * nx + ny * ny);
  const unx = nx / len;
  const uny = ny / len;

  // Calculate relative velocity
  const vrx = box2.dx - box1.dx;
  const vry = box2.dy - box1.dy;

  // Calculate velocity along the normal
  const velocityAlongNormal = vrx * unx + vry * uny;

  // Don't resolve if velocities are separating
  if (velocityAlongNormal > 0) return;

  // Calculate restitution (bounciness)
  const restitution = 0.1;

  // Calculate impulse scalar
  const impulseScalar = -(1 + restitution) * velocityAlongNormal;

  // Apply impulse
  const impulseX = impulseScalar * unx;
  const impulseY = impulseScalar * uny;

  box1.dx -= impulseX;
  box1.dy -= impulseY;
  box2.dx += impulseX;
  box2.dy += impulseY;

  // Separate the boxes to prevent sticking
  const percent = 0.2; // usually 20% to 80%
  const slop = 0.01; // usually 0.01 to 0.1
  const penetrationDepth = box1.size - len;

  if (penetrationDepth > slop) {
    const separationX = unx * (penetrationDepth * percent);
    const separationY = uny * (penetrationDepth * percent);

    box1.x -= separationX / 2;
    box1.y -= separationY / 2;
    box2.x += separationX / 2;
    box2.y += separationY / 2;
  }
}

const numBoxes = 13;
const bodyBox = { width: 60, height: 160 };
// const circle = { x: 0, y: 0, radius: 20 };

let gameWidth = 800;
let gameHeight = 600;

// 12 colors, 13th is red
const colors = [
  "#FF8000",
  "#FFFF00",
  "#80FF00",
  "#00FF00",
  "#00FF80",
  "#00FFFF",
  "#0080FF",
  "#0000FF",
  "#8000FF",
  "#FF00FF",
  "#FF0080",
  "#FF7020",
  "#FF0000",
];

function hexToRgb(hex: string) {
  // turn hex to rgb
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}
// Initialize boxes with random positions and values
function initBoxes(width: number, height: number) {
  gameWidth = width;
  gameHeight = height;

  boxes.length = 0; // Clear the boxes array
  for (let i = 0; i < numBoxes; i++) {
    const value = i + 1;
    let { r, g, b } = hexToRgb(colors[value - 1]);

    if (!avoid13 && value === 13) {
      r = 0;
      g = 255;
      b = 0;
    } else if (!avoid13 && value !== 13) {
      r = 255;
      g = 0;
      b = 0;
    } else if (avoid13 && value === 13) {
      // console.log("avoid13", avoid13);
      r = 255;
      g = 0;
      b = 0;
    } else if (avoid13 && value !== 13) {
      r = 0;
      g = 255;
      b = 0;
    }

    const box: Box = {
      x: Math.random() * width,
      y: Math.random() * height,
      size: 60,
      value: value,
      enemy: value === 13 ? 1 : 0,
      dx: (Math.random() - 0.5) * (value === 13 ? 8 : 4),
      dy: (Math.random() - 0.5) * (value === 13 ? 8 : 4),
      r: r,
      g: g,
      b: b,
      collision: false,
      radiance: 0,
    };

    respawnBox(box, width, height);
    boxes.push(box);
  }
}

let gamestopCb: () => void;
const onGameStop = (cb: () => void) => {
  gamestopCb = cb;
};

export { onGameStop };
export { initBoxes };

// Update positions and check for collisions
export function update(
  currentTime: number,
  timer: HTMLElement,
  scoreEl: HTMLElement,
  livesEl: HTMLElement,
  gameoverEl: HTMLElement,
  mouseX: number,
  mouseY: number,
  rotation: number,
  supermodeWanted: boolean,
) {
  if (!gameStarted) {
    return;
  }
  // if (!gameStarted) {
  //   gameStarted = true;
  //   const over = document.getElementById("over");
  //   if (over) {
  //     over.style.display = "block";
  //   }
  //   displayHighScores();
  // }
  // return;

  // }
  //   return true;
  ctx.clearRect(0, 0, gameWidth, gameHeight);
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  timeLeft -= deltaTime / 10; // Decrease time by deltaTime in 1/100ths of a second
  timer.innerText = `${(13 - timeLeft / 100).toFixed(2).replace(".", ":")}s (${wave})`;

  // Draw and move the boxes
  for (let i = 0; i < boxes.length; i++) {
    // Draw box
    ctx.strokeStyle = "black";
    ctx.rect(
      boxes[i].x - boxes[i].size / 2,
      gameHeight - boxes[i].y - boxes[i].size / 2,
      boxes[i].size,
      boxes[i].size,
    );
    ctx.stroke();

    const box = boxes[i];

    if (avoid13) {
      box.enemy = box.value === 13 ? 1 : 0;
    } else {
      box.enemy = box.value !== 13 ? 1 : 0;
    }
    // Speed up boxes as time decreases
    const speedMultiplier = 0.1 + wave / 10;

    // box.y = 100;
    // box.x = 100 + i * 100;
    box.x += (box.dx * speedMultiplier * deltaTime) / 10;
    box.y += (box.dy * speedMultiplier * deltaTime) / 10;

    if (!box.collision) {
      // Enable collision once box is ENTIRELY in bounds
      if (
        box.x - box.size > 0 &&
        box.x + box.size < gameWidth &&
        box.y - box.size > 0 &&
        box.y + box.size < gameHeight
      ) {
        box.collision = true;
      } else {
        continue;
      }
    } else {
      box.radiance = Math.min(box.radiance + deltaTime / 2000, 1.0);
    }
    // Bounce off the walls
    if (box.x - box.size / 2 < 0 || box.x + box.size / 2 > gameWidth) box.dx *= -1;
    if (box.y - box.size / 2 < 0 || box.y + box.size / 2 > gameHeight) box.dy *= -1;

    // Go to the other side of the screen
    // if (box.x - box.size / 2 > gameWidth) box.x = -box.size / 2;
    // if (box.x + box.size / 2 < 0) box.x = gameWidth + box.size / 2;
    // if (box.y - box.size / 2 > gameHeight) box.y = -box.size / 2;
    // if (box.y + box.size / 2 < 0) box.y = gameHeight + box.size / 2;

    // Check for collision with other boxes
    for (let j = i + 1; j < boxes.length; j++) {
      const other = boxes[j];
      if (checkCollisionBox(box, other)) {
        resolveCollision(box, other);
      }
    }

    // Check for collision with the player
    if (checkCollision(bodyBox, box, mouseX, mouseY, -rotation) && tempInvincibility <= 0.1) {
      if (
        (!avoid13 && box.value === 13) ||
        (avoid13 && box.value !== 13) ||
        (supermodeWanted && superModeAvailable)
      ) {
        playSound(box.value);
        score += box.value;
        if (superMode < 100) {
          superMode += box.value;
          superMode = Math.min(superMode, 100);
        }
        if (superMode > 0) {
          superModeAvailable = 1.0;
        }
      } else if ((avoid13 && box.value === 13) || (!avoid13 && box.value !== 13)) {
        lives -= 1;
        score -= box.value;
        score = Math.max(0, score);
        tempInvincibility = 1.0;
        playSound(0);
      }

      respawnBox(box, gameWidth, gameHeight);
    }
  }

  // Update score and lives
  scoreEl.innerText = `${score}`;
  // A heart emoji for each life
  livesEl.innerText = "❤️".repeat(Math.max(0, lives));
  // Update super mode
  if (supermodeWanted && superModeAvailable) {
    superMode = Math.max(0, superMode - deltaTime / 30);
    if (superMode === 0) {
      superModeAvailable = 0.0;
    }
  }
  if (!supermodeWanted && superMode <= 0) {
    superModeAvailable = 0.0;
  }

  setProgress(superMode);
  // Check for game over
  if (lives >= 0) {
    if (timeLeft < 0) {
      wave++;
      avoid13 = wave % 2 !== 0; // Toggle the avoid/hunt rule
      timeLeft = 1300; // Reset time to 13 seconds
      shouldlevelRestart(true);
      initBoxes(gameWidth, gameHeight); // Respawn the boxes
    }
  } else {
    playSound(0);
    gameoverEl.style.display = "block";

    const highscore = storeHighScore({
      score,
      time: (wave - 1) * 13 + (1300 - timeLeft) / 100,
    });

    displayHighScores(highscore);
    // Use the Speech Synthesis API to say the score
    // const utterance = new SpeechSynthesisUtterance(`You LOSE!`);
    // speechSynthesis.speak(utterance);
    gameStarted = false;
    if (gamestopCb) {
      gamestopCb();
    }
    // Respawn all boxes
    initBoxes(gameWidth, gameHeight);
    return false;
  }
}

function respawnBox(box: Box, gameWidth: number, gameHeight: number) {
  // Randomly choose a side to spawn the box (0 = left, 1 = right, 2 = top, 3 = bottom)
  const side = Math.floor(Math.random() * 4);
  box.collision = false;

  if (side === 0) {
    // Spawn to the left
    box.x = -box.size;
    box.y = Math.random() * gameHeight;
  } else if (side === 1) {
    // Spawn to the right
    box.x = gameWidth + box.size;
    box.y = Math.random() * gameHeight;
  } else if (side === 2) {
    // Spawn above
    box.x = Math.random() * gameWidth;
    box.y = -box.size;
  } else if (side === 3) {
    // Spawn below
    box.x = Math.random() * gameWidth;
    box.y = gameHeight + box.size;
  }

  // Choose a random target position within the game bounds
  const targetX = Math.random() * gameWidth * 0.5 + gameWidth * 0.25;
  const targetY = Math.random() * gameHeight * 0.5 + gameHeight * 0.25;

  // Calculate the direction vector towards the target
  const directionX = targetX - box.x;
  const directionY = targetY - box.y;
  const length = Math.sqrt(directionX * directionX + directionY * directionY);

  // Normalize the direction and scale it by the desired speed
  const speed = box.value === 13 ? 8 : 4;
  box.dx = (directionX / length) * speed;
  box.dy = (directionY / length) * speed;
}

function setProgress(value: number) {
  const circle = document.getElementById("progress-circle");
  //   const text = document.getElementById("progress-text");
  const progressValue = Math.min(Math.max(value, 0), 100); // Clamp value between 0 and 100

  // Update the circular progress bar
  const angle = (progressValue / 100) * 360;
  if (!circle) {
    return;
  }

  circle.style.background = `conic-gradient(#fff ${angle}deg, #000 ${angle}deg)`;

  // Add blinking effect if full
  if (progressValue >= 100) {
    circle.classList.add("blinking");
  } else {
    circle.classList.remove("blinking");
  }
}

lastTime = performance.now();
// update(lastTime);
