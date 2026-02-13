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
      { name:"Back Squat", sets:3, reps:10 },
      { name:"Romanian Deadlift", sets:3, reps:10 },
      { name:"Walking Lunges", sets:3, reps:12 },
      { name:"Leg Press", sets:3, reps:10 },
      { name:"Calf Raises", sets:4, reps:12 }
    ]
  },
  {
    name:"Upper Pull + Core",
    exercises:[
      { name:"Lat Pulldown", sets:3, reps:10 },
      { name:"Seated Row", sets:3, reps:10 },
      { name:"Face Pull", sets:3, reps:15 },
      { name:"Rear Delt Fly", sets:3, reps:15 },
      { name:"Biceps Curl", sets:3, reps:12 }
    ]
  },
  {
    name:"Run + Glutes",
    exercises:[
      { name:"Hip Thrust", sets:4, reps:10 },
      { name:"Cable Kickbacks", sets:3, reps:15 },
      { name:"Step Ups", sets:3, reps:12 },
      { name:"Plank", sets:3, reps:30 }
    ]
  },
  {
    name:"Active Recovery",
    exercises:[
      { name:"45–60 min walk / mobility", sets:1, reps:1 }
    ]
  },
  {
    name:"Lower Hypertrophy",
    exercises:[
      { name:"Hack Squat", sets:4, reps:12 },
      { name:"Bulgarian Split Squat", sets:3, reps:10 },
      { name:"Leg Curl", sets:4, reps:12 },
      { name:"Cable Pull Through", sets:3, reps:15 },
      { name:"Calves", sets:4, reps:15 }
    ]
  },
  {
    name:"Shoulders + Upper Back",
    exercises:[
      { name:"Machine Shoulder Press", sets:3, reps:10 },
      { name:"Lateral Raise", sets:4, reps:15 },
      { name:"Cable Y Raise", sets:3, reps:15 },
      { name:"Assisted Pullups", sets:3, reps:8 },
      { name:"Rope Rows", sets:3, reps:12 }
    ]
  },
  {
    name:"Long Easy Run",
    exercises:[
      { name:"Comfortable 3–6km Run", sets:1, reps:1 }
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
