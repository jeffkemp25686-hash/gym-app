// ==========================
// ALANA TRAINING APP
// STAGE 2 — WORKOUT ENGINE
// ==========================

const app = document.getElementById("app");

const STORAGE_DAY = "currentTrainingDay";

// --------------------------
// PROGRAM STRUCTURE
// --------------------------

const program = [
  {
    name: "Lower Body Strength",
    exercises: [
      "Back Squat",
      "Romanian Deadlift",
      "Walking Lunges",
      "Leg Press",
      "Calf Raises"
    ]
  },
  {
    name: "Upper Pull + Core",
    exercises: [
      "Lat Pulldown",
      "Seated Row",
      "Face Pull",
      "Rear Delt Fly",
      "Biceps Curl"
    ]
  },
  {
    name: "Run + Glutes",
    exercises: [
      "Easy Run",
      "Hip Thrust",
      "Cable Kickbacks",
      "Step Ups",
      "Plank"
    ]
  },
  {
    name: "Active Recovery",
    exercises: [
      "45–60 min walk / bike / mobility"
    ]
  },
  {
    name: "Lower Hypertrophy",
    exercises: [
      "Hack Squat",
      "Bulgarian Split Squat",
      "Leg Curl",
      "Cable Pull Through",
      "Calves"
    ]
  },
  {
    name: "Shoulders + Upper Back",
    exercises: [
      "Machine Shoulder Press",
      "Lateral Raises",
      "Cable Y Raise",
      "Assisted Pullups",
      "Rope Rows"
    ]
  },
  {
    name: "Long Easy Run",
    exercises: [
      "Comfortable 3–6 km Run"
    ]
  }
];

// --------------------------
// NAVIGATION
// --------------------------

function showTab(tab) {
  if (tab === "today") renderToday();
  if (tab === "run") renderRun();
  if (tab === "nutrition") renderNutrition();
  if (tab === "progress") renderProgress();
}

window.showTab = showTab;

// --------------------------
// GET CURRENT DAY
// --------------------------

function getCurrentDay() {
  let day = localStorage.getItem(STORAGE_DAY);
  if (!day) {
    day = 0;
    localStorage.setItem(STORAGE_DAY, day);
  }
  return parseInt(day);
}

function nextDay() {
  let day = getCurrentDay();
  day = (day + 1) % program.length;
  localStorage.setItem(STORAGE_DAY, day);
  renderToday();
}

// --------------------------
// TODAY TAB
// --------------------------

function renderToday() {

  const dayIndex = getCurrentDay();
  const day = program[dayIndex];

  let html = `
    <div class="card">
      <h2>Today</h2>
      <h3>${day.name}</h3>
  `;

  day.exercises.forEach((ex, i) => {

    const keyW = `d${dayIndex}-e${i}-w`;
    const keyR = `d${dayIndex}-e${i}-r`;

    const weight = localStorage.getItem(keyW) || "";
    const rpe = localStorage.getItem(keyR) || "";

    html += `
      <label>${ex}</label>
      <input
        placeholder="Weight"
        value="${weight}"
        oninput="localStorage.setItem('${keyW}', this.value)"
      >

      <input
        placeholder="RPE"
        value="${rpe}"
        oninput="localStorage.setItem('${keyR}', this.value)"
      >
    `;
  });

  html += `
      <button onclick="nextDay()">Finish Workout ✅</button>
    </div>
  `;

  app.innerHTML = html;
}

// --------------------------
// RUN TAB
// --------------------------

function renderRun() {
  app.innerHTML = `
    <div class="card">
      <h2>Running Log</h2>

      <label>Run Time</label>
      <input placeholder="28:30">
    </div>
  `;
}

// --------------------------
// NUTRITION TAB (HABITS)
// --------------------------

function renderNutrition() {
  app.innerHTML = `
    <div class="card">
      <h2>Nutrition Check</h2>

      <button>Protein Goal ✅</button><br><br>
      <button>Water Goal ✅</button><br><br>
      <button>Veg Intake ✅</button>

      <label>Energy (1–5)</label>
      <input placeholder="Energy level">
    </div>
  `;
}

// --------------------------
// PROGRESS TAB
// --------------------------

function renderProgress() {
  app.innerHTML = `
    <div class="card">
      <h2>Progress</h2>
      <p>Graphs coming soon.</p>
    </div>
  `;
}

// INITIAL LOAD
renderToday();
