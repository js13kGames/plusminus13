const localStorageName = "+-13-AOSDfkpok4034-HIGHSCORE";

type HighScore = {
  id?: number;
  score?: number;
  adjustedScore?: number;
  time?: number;
  name?: string;
  resolution?: string;
};

const calculateAdjustedScore = (score: number): number => {
  const resolution = getCurrentResolution();
  const [width, height] = resolution.split("x").map(Number);
  const totalPixels = width * height;
  const baseResolution = 1024 * 1024;
  const adjustmentFactor = Math.sqrt(baseResolution / totalPixels);
  return Math.round(score * adjustmentFactor);
};

const storeHighScore = ({ id, score, time, name }: HighScore) => {
  const resolution = getCurrentResolution();
  const highScores = JSON.parse(localStorage.getItem(localStorageName) || "[]");
  const adjustedScore = calculateAdjustedScore(score!);

  if (id === undefined) {
    id = Date.now();
    highScores.push({ id, score, adjustedScore, time, name: "Player", resolution });
  } else {
    const existingScore = highScores.find((entry: { id: number }) => entry.id === id);
    if (existingScore) {
      existingScore.name = name;
      existingScore.resolution = resolution;
      existingScore.adjustedScore = adjustedScore;
    } else {
      console.error("Could not find high score with ID", id);
    }
  }

  // Sort by adjusted score (descending) and then by time (ascending)
  highScores.sort(
    (a: { adjustedScore: number; time: number }, b: { adjustedScore: number; time: number }) =>
      b.adjustedScore - a.adjustedScore || a.time - b.time,
  );

  localStorage.setItem(localStorageName, JSON.stringify(highScores));
  return id;
};

const displayHighScores = (id?: number) => {
  const highScoresList = document.getElementById("scoreboard");
  if (!highScoresList) return;
  highScoresList.innerHTML = "";
  const highScores = JSON.parse(localStorage.getItem(localStorageName) || "[]");

  highScores.slice(0, 10).forEach((entry: HighScore, index: number) => {
    const scoreEntry = score(entry, index, !!id && id === entry.id);
    highScoresList.appendChild(scoreEntry);
  });

  const playerScore = highScores.find((entry: { id: number }) => entry.id === id);
  if (playerScore && highScores.length > 10 && highScores.indexOf(playerScore) >= 10) {
    const playerIndex = highScores.indexOf(playerScore);
    const scoreEntry = score(playerScore, playerIndex, true);
    highScoresList.appendChild(scoreEntry);
  }
};

const score = (entry: HighScore, index: number, showInput: boolean) => {
  const scoreEntry = document.createElement("div");
  scoreEntry.className = "score-entry";

  if (showInput) {
    scoreEntry.className += " current-player";
    scoreEntry.innerHTML = `
      <div class="place">${index + 1}</div>
      <div class="name">
        <form id="name-form">
          <input type="text" value="${entry.name || ""}" placeholder="Enter name" class="name-input" autofocus />
        </form>
      </div>
      <div class="score">${entry.adjustedScore} (${entry.score})</div>
      <div class="time">${entry.time?.toFixed(2).replace(".", ":")}s</div>
      <div class="resolution">${entry.resolution || "N/A"}</div>
    `;

    const form = scoreEntry.querySelector("form");
    const input = scoreEntry.querySelector("input");
    if (form && input) {
      input.focus();
      form.onsubmit = (event) => {
        event.preventDefault();
        const newName = input.value.trim();
        if (newName) {
          storeHighScore({
            id: entry.id,
            name: newName,
            score: entry.score,
            resolution: getCurrentResolution(),
          });
          displayHighScores();
        }
      };
    }
  } else {
    scoreEntry.innerHTML = `
      <div class="place">${index + 1}</div>
      <div class="name">${entry.name || "---"}</div>
      <div class="score">${entry.adjustedScore} (${entry.score})</div>
      <div class="time">${entry.time?.toFixed(2).replace(".", ":")}s</div>
      <div class="resolution">${entry.resolution || "N/A"}</div>
    `;
  }

  return scoreEntry;
};

const getCurrentResolution = () => {
  return `${window.innerWidth}x${window.innerHeight}`;
};

export { storeHighScore, displayHighScores, getCurrentResolution };
