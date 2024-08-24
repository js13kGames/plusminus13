const localStorageName = "d094309ufdHIGHSCORE";

const storeHighScore = (score: number, time: number, id?: number) => {
  // Retrieve high scores from local storage
  const highScores = JSON.parse(localStorage.getItem(localStorageName) || "[]");

  // Generate a quick unique ID for this score
  if (!id) {
    highScores.push({ id, score, time, name: "Player" });
    id = Date.now();
  } else {
    // Find the existing score and update it
    const entry = highScores.find((entry: any) => entry.id === id);
    if (entry) {
      entry.score = score;
      entry.time = time;
    } else {
      highScores.push({ id, score, time, name: "Player" });
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
const displayHighScores = (id: number) => {
  // Render the top 10 high scores
  const highScoresList = document.getElementById("scoreboard");
  // Clear previous content
  if (!highScoresList) return;
  highScoresList.innerHTML = "";
  const highScores = JSON.parse(localStorage.getItem(localStorageName) || "[]");

  highScores
    .slice(0, 10)
    .forEach((entry: { name: any; score: any; time: any; id: number }, index: number) => {
      const scoreEntry = score(entry, id, index, id === entry.id);
      if (highScoresList) {
        highScoresList.appendChild(scoreEntry);
      }
    });
};

const score = (
  entry: { name: any; score: any; time: any; id: any },
  id: number,
  index: number,
  showInput: boolean,
) => {
  const scoreEntry = document.createElement("div");
  scoreEntry.className = "score-entry";

  if (showInput) {
    scoreEntry.className += " current-player";

    // Create a form element
    const form = document.createElement("form");

    // Create an input box for entering the name
    const input = document.createElement("input");
    input.type = "text";
    input.value = entry.name; // Default value is "Player"
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
        entry.name = newName;
        storeHighScore(entry.score, entry.time, entry.id); // Update the high score
        displayHighScores(id); // Re-render the high scores list
      }
    };

    // Append the input and button to the form
    form.appendChild(input);
    form.appendChild(submitButton);

    // Append the form to the score entry
    scoreEntry.appendChild(form);
  } else {
    scoreEntry.innerHTML = `${index + 1}. ${entry.name || "---"} - ${entry.score} points - ${entry.time}s`;
  }

  return scoreEntry;
};

export { storeHighScore, displayHighScores };
