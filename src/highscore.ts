const localStorageName = "d094309ufdHIGHSCORE";

type HighScore = {
  id?: number;
  score?: number;
  time?: number;
  name?: string;
};

let outsideStartGameFn: () => void;

export const setStartGameFn = (fn: () => void) => {
  outsideStartGameFn = fn;
};

const storeHighScore = ({ id, score, time, name }: HighScore) => {
  // Retrieve high scores from local storage
  const highScores = JSON.parse(localStorage.getItem(localStorageName) || "[]");

  // Generate a quick unique ID for this score
  if (id === undefined) {
    id = Date.now();
    highScores.push({ id, score, time, name: "Player" });
  } else {
    // Find the existing score and update it
    const existingScore = highScores.find((entry: { id: number }) => entry.id === id);
    if (existingScore) {
      existingScore.name = name;
    } else {
      console.error("Could not find high score with ID", id);
    }
  }
  // Add player's score to high scores array

  // Sort by score (descending) and then by time (ascending)
  highScores.sort(
    (a: { score: number; time: number }, b: { score: number; time: number }) =>
      b.score - a.score || a.time - b.time,
  );

  // Save updated high scores back to local storage
  localStorage.setItem(localStorageName, JSON.stringify(highScores));
  return id;
};

// Gets the high scores from local storage, taking the id of the current player as input
// The current player can then change their name in the high scores list
const displayHighScores = (id?: number) => {
  // Render the top 10 high scores
  const highScoresList = document.getElementById("scoreboard");
  // Clear previous content
  if (!highScoresList) return;
  highScoresList.innerHTML = "";
  const highScores = JSON.parse(localStorage.getItem(localStorageName) || "[]");

  // If the player is below the top 10, add them to the list
  highScores
    .slice(0, 10)
    .forEach((entry: { name: any; score: any; time: any; id: number }, index: number) => {
      const scoreEntry = score(entry, index, !!id && id === entry.id);
      if (highScoresList) {
        highScoresList.appendChild(scoreEntry);
      }
    });

  // If the player is below the top 10, add them to the list
  const playerScore = highScores.find((entry: { id: number }) => entry.id === id);
  if (playerScore && highScores.length > 10 && highScores.indexOf(playerScore) >= 10) {
    const playerIndex = highScores.indexOf(playerScore);
    const scoreEntry = score(playerScore, playerIndex, true);
    if (highScoresList) {
      highScoresList.appendChild(scoreEntry);
    }
  }
};

const score = (entry: HighScore, index: number, showInput: boolean) => {
  const scoreEntry = document.createElement("div");
  scoreEntry.className = "score-entry";

  if (showInput) {
    scoreEntry.className += " current-player";

    // Create a form element
    const form = document.createElement("form");

    // Create an input box for entering the name
    const input = document.createElement("input");
    input.type = "text";
    input.value = entry.name || ""; // Default value is "Player"
    input.placeholder = "Enter your name";
    input.className = "name-input";

    // Create a submit button
    const submitButton = document.createElement("button");
    submitButton.type = "submit";
    submitButton.textContent = "Save";

    // Handle form submission
    form.onsubmit = (event) => {
      event.preventDefault();
      const newName = input.value.trim();
      if (newName) {
        storeHighScore({ id: entry.id, name: newName }); // Update the high score
        displayHighScores(); // Re-render the high scores list
      }
    };

    // Append the input and button to the form
    form.appendChild(input);
    form.appendChild(submitButton);

    // Append the form to the score entry
    scoreEntry.appendChild(form);
  } else {
    scoreEntry.innerHTML = `${index + 1}. ${entry.name || "---"} - ${entry.score} points - ${entry.time?.toFixed(2).replace(".", ":")}s`;
  }

  return scoreEntry;
};

export { storeHighScore, displayHighScores };
