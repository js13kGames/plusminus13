let score = 0;
let lives = 3;
let timeLeft = 1300; // 13 seconds in 1/100ths of a second
let wave = 1;
let avoid13 = true;
let lastTime = 0;

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
}

export const boxes: Box[] = [];
export let superMode = 0;
export let superModeAvailable = 0;
const numBoxes = 13;
const bodyBox = { width: 40, height: 90 };
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
    const value = i + 1; // Math.floor(Math.random() * 13) + 1;

    const { r, g, b } = hexToRgb(colors[value - 1]);
    boxes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 40,
      value: value,
      enemy: value === 13 ? 1 : 0,
      dx: (Math.random() - 0.5) * (value === 13 ? 8 : 4),
      dy: (Math.random() - 0.5) * (value === 13 ? 8 : 4),
      r: r,
      g: g,
      b: b,
    });
  }
}

export { initBoxes };

// Update positions and check for collisions
export function update(
  currentTime: number,
  timer: HTMLElement,
  scoreEl: HTMLElement,
  livesEl: HTMLElement,
  mouseX: number,
  mouseY: number,
  mouseDown: boolean,
) {
  //   return true;
  const deltaTime = currentTime - lastTime;
  lastTime = currentTime;

  timeLeft -= deltaTime / 10; // Decrease time by deltaTime in 1/100ths of a second
  timer.innerText = `${(timeLeft / 100).toFixed(2).replace(".", ":")}s (${wave})`;

  //   ctx.clearRect(0, 0, gameWidth, canvas.height);

  // Draw the circle
  //   ctx.beginPath();
  //   ctx.arc(mouseX, mouseY, bodyBox.width, 0, Math.PI * 2);
  //   ctx.fillStyle = "#007BFF";
  //   ctx.fill();
  //   ctx.closePath();

  // Draw and move the boxes
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];

    if (avoid13) {
      box.enemy = box.value === 13 ? 1 : 0;
    } else {
      box.enemy = box.value !== 13 ? 1 : 0;
    }
    // Speed up boxes as time decreases
    const speedMultiplier = 1 + (3 * (1300 - timeLeft)) / 1300;

    // box.y = 100;
    // box.x = 100 + i * 100;
    box.x += (box.dx * speedMultiplier * deltaTime) / 10;
    box.y += (box.dy * speedMultiplier * deltaTime) / 10;

    // Bounce off the walls
    if (box.x - box.size < 0 || box.x + box.size > gameWidth) box.dx *= -1;
    if (box.y - box.size < 0 || box.y + box.size > gameHeight) box.dy *= -1;

    // Check for collision with other boxes
    for (let j = 0; j < boxes.length; j++) {
      if (i !== j) {
        const other = boxes[j];
        if (
          box.x < other.x + other.size &&
          box.x + box.size > other.x &&
          box.y < other.y + other.size &&
          box.y + box.size > other.y
        ) {
          box.dx *= -1;
          box.dy *= -1;
          other.dx *= -1;
          other.dy *= -1;
        }
      }
    }

    // Slow them down each frame
    box.dx *= 0.99;
    box.dy *= 0.99;
    // Determine box color based on wave rules
    // if (avoid13) {
    //   ctx.fillStyle = box.value === 13 ? "#FF0000" : "#00FF00";
    // } else {
    //   ctx.fillStyle = box.value === 13 ? "#00FF00" : "#FF0000";
    // }

    // Draw the box
    // ctx.fillRect(box.x, box.y, box.size, box.size);

    // Draw the value
    // ctx.fillStyle = "#000";
    // ctx.font = "20px Arial";
    // ctx.fillText(box.value, box.x + 10, box.y + 30);

    // Check for collision with the circle
    if (
      mouseX < box.x + box.size &&
      mouseX + bodyBox.width > box.x &&
      mouseY < box.y + box.size &&
      mouseY + bodyBox.height > box.y
    ) {
      if (
        (!avoid13 && box.value === 13) ||
        (avoid13 && box.value !== 13) ||
        (mouseDown && superModeAvailable)
      ) {
        score += box.value;
        if (superMode < 100) {
          superMode += box.value;
          superMode = Math.min(superMode, 100);
        }
        if (superMode === 100) {
          superModeAvailable = 1.0;
        }
      } else if ((avoid13 && box.value === 13) || (!avoid13 && box.value !== 13)) {
        lives -= 1;
      }

      // Respawn the box in a new location
      box.x = Math.random() * gameWidth;
      box.y = Math.random() * gameHeight;
      box.value = Math.floor(Math.random() * 13) + 1;
      box.dx = (Math.random() - 0.5) * (box.value === 13 ? 8 : 4);
      box.dy = (Math.random() - 0.5) * (box.value === 13 ? 8 : 4);
    }
  }

  // Update score and lives
  scoreEl.innerText = `${score}`;
  // A heart emoji for each life
  livesEl.innerText = "❤️".repeat(lives);
  // Update super mode
  if (mouseDown && superModeAvailable) {
    superMode = Math.max(0, superMode - deltaTime / 20);
    if (superMode === 0) {
      superModeAvailable = 0.0;
    }
  }
  if (!mouseDown && superMode < 100) {
    superModeAvailable = 0.0;
  }

  setProgress(superMode);
  // Check for game over
  if (lives > 0) {
    if (timeLeft < 0) {
      wave++;
      avoid13 = !avoid13; // Toggle the avoid/hunt rule
      timeLeft = 1300; // Reset time to 13 seconds
      initBoxes(gameWidth, gameHeight); // Respawn the boxes
    }
  } else {
    throw new Error("Game Over! Final Score: " + score);

    location.reload();
  }
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

  circle.style.background = `conic-gradient(#000 ${angle}deg, #fff ${angle}deg)`;

  // Add blinking effect if full
  if (progressValue >= 100) {
    circle.classList.add("blinking");
  } else {
    circle.classList.remove("blinking");
  }
}

lastTime = performance.now();
// update(lastTime);
