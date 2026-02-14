// ==========================
// ALANA TRAINING APP
// WORKOUT ENGINE + SET LOGGING + SUGGESTIONS + COACH SYNC
// ==========================

const SHEETS_URL = "https://script.google.com/macros/s/AKfycbw5jJ4Zk0TtCp9etm2ImxxsSqsxiLoCxZ_U50tZwE1LdqPbkw3hEan8r1YgUCgs7vJaTA/exec";
const ATHLETE = "Alana";

const app = document.getElementById("app");
const STORAGE_DAY = "currentTrainingDay";

function timeToMinutes(timeStr) {
  if (!timeStr) return null;

  if (timeStr.includes(":")) {
    const parts = timeStr.split(":");
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1] || 0);
    return mins + secs / 60;
  }

  return parseFloat(timeStr);
}

function calculatePace(distance, timeStr) {
  const mins = timeToMinutes(timeStr);
  if (!distance || !mins) return "";

  const pace = mins / distance;
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);

  return `${m}:${String(s).padStart(2,"0")} /km`;
}

// --------------------------
// PROGRAM STRUCTURE
// --------------------------
const program = [
  {
    name: "Lower Body Strength",
    exercises: [
      { name: "Back Squat", sets: 3, reps: 10 },
      { name: "Romanian Deadlift", sets: 3, reps: 10 },
      { name: "Walking Lunges", sets: 3, reps: 12 },
      { name: "Leg Press", sets: 3, reps: 10 },
      { name: "Calf Raises", sets: 4, reps: 12 },
    ],
  },
  {
    name: "Upper Pull + Core",
    exercises: [
      { name: "Lat Pulldown", sets: 3, reps: 10 },
      { name: "Seated Row", sets: 3, reps: 10 },
      { name: "Face Pull", sets: 3, reps: 15 },
      { name: "Rear Delt Fly", sets: 3, reps: 15 },
      { name: "Biceps Curl", sets: 3, reps: 12 },
    ],
  },
  {
    name: "Run + Glutes",
    exercises: [
      { name: "Hip Thrust", sets: 4, reps: 10 },
      { name: "Cable Kickbacks", sets: 3, reps: 15 },
      { name: "Step Ups", sets: 3, reps: 12 },
      { name: "Plank", sets: 3, reps: 30 },
    ],
  },
  {
    name: "Active Recovery",
    exercises: [{ name: "45–60 min walk / mobility", sets: 1, reps: 1 }],
  },
  {
    name: "Lower Hypertrophy",
    exercises: [
      { name: "Hack Squat", sets: 4, reps: 12 },
      { name: "Bulgarian Split Squat", sets: 3, reps: 10 },
      { name: "Leg Curl", sets: 4, reps: 12 },
      { name: "Cable Pull Through", sets: 3, reps: 15 },
      { name: "Calves", sets: 4, reps: 15 },
    ],
  },
  {
    name: "Shoulders + Upper Back",
    exercises: [
      { name: "Machine Shoulder Press", sets: 3, reps: 10 },
      { name: "Lateral Raise", sets: 4, reps: 15 },
      { name: "Cable Y Raise", sets: 3, reps: 15 },
      { name: "Assisted Pullups", sets: 3, reps: 8 },
      { name: "Rope Rows", sets: 3, reps: 12 },
    ],
  },
  {
    name: "Long Easy Run",
    exercises: [{ name: "Comfortable 3–6km Run", sets: 1, reps: 1 }],
  },
];

// --------------------------
// NAVIGATION (for your bottom nav)
// --------------------------
function showTab(tab) {
  if (tab === "today") renderToday();
  if (tab === "run") renderRun();
  if (tab === "nutrition") renderNutrition();
  if (tab === "progress") renderProgress();
}
window.showTab = showTab;

// --------------------------
// DAY TRACKING
// --------------------------
function getCurrentDay() {
  let day = localStorage.getItem(STORAGE_DAY);
  if (!day) {
    day = "0";
    localStorage.setItem(STORAGE_DAY, day);
  }
  return parseInt(day, 10);
}

function nextDay() {
  let day = getCurrentDay();
  day = (day + 1) % program.length;
  localStorage.setItem(STORAGE_DAY, String(day));
  renderToday();
}
window.nextDay = nextDay;

// --------------------------
// REST TIMER (60s)
// --------------------------
function startRestTimer(btn) {
  let seconds = 60;
  btn.disabled = true;

  const interval = setInterval(() => {
    btn.innerText = `Rest ${seconds}s`;
    seconds--;

    if (seconds < 0) {
      clearInterval(interval);
      btn.innerText = "Start 60s Rest";
      btn.disabled = false;
    }
  }, 1000);
}
window.startRestTimer = startRestTimer;

// --------------------------
// PROGRESSION SUGGESTION (avg reps vs target)
// --------------------------
function getSuggestion(dayIndex, exIndex, targetReps) {
  let totalWeight = 0;
  let totalReps = 0;
  let setsLogged = 0;

  for (let s = 1; s <= 6; s++) {
    const w = parseFloat(localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-w`));
    const r = parseFloat(localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-r`));

    if (!isNaN(w) && !isNaN(r)) {
      totalWeight += w;
      totalReps += r;
      setsLogged++;
    }
  }

  if (!setsLogged) return "";

  const avgWeight = totalWeight / setsLogged;
  const avgReps = totalReps / setsLogged;

  let increase = 0;
  if (avgReps >= targetReps) increase = 2.5;
  else if (avgReps >= targetReps - 1) increase = 1.25;

  return (avgWeight + increase).toFixed(1);
}

// --------------------------
// TODAY TAB (sets + reps + sync)
// --------------------------
function renderToday() {
  const dayIndex = getCurrentDay();
  const day = program[dayIndex];

  let html = `
    <div class="card">
      <h2>Today</h2>
      <h3>${day.name}</h3>
  `;

  day.exercises.forEach((ex, exIndex) => {
    const suggestion = getSuggestion(dayIndex, exIndex, ex.reps);

    html += `
      <h4>${ex.name} — ${ex.sets} x ${ex.reps}</h4>
      <small style="color:#666;">
        ${suggestion ? `Suggested next time: ${suggestion} kg` : ""}
      </small>
    `;

    for (let s = 1; s <= ex.sets; s++) {
      const weightKey = `d${dayIndex}-e${exIndex}-s${s}-w`;
      const repsKey = `d${dayIndex}-e${exIndex}-s${s}-r`;

      const weight = localStorage.getItem(weightKey) || "";
      const reps = localStorage.getItem(repsKey) || "";

      html += `
        <div style="margin-bottom:8px;">
          Set ${s}<br>
          <input
            placeholder="Weight"
            value="${weight}"
            oninput="localStorage.setItem('${weightKey}', this.value)"
          >
          <input
            placeholder="Reps"
            value="${reps}"
            oninput="localStorage.setItem('${repsKey}', this.value)"
          >
        </div>
      `;
    }

    html += `
      <button onclick="startRestTimer(this)">Start 60s Rest</button>
      <hr>
    `;
  });

  html += `
      <button onclick="syncToCoach()">Sync to Coach ✅</button>
      <p id="syncStatus" style="color:#666; margin-top:8px;"></p>

      <button onclick="nextDay()" style="margin-top:10px;">Finish Workout ✅</button>
      <p style="color:green;">✓ Auto saved</p>
    </div>
  `;

  app.innerHTML = html;
}

// --------------------------
// SYNC TO COACH (Sets only for now)
// Sheet tab required: "Sets"
// --------------------------
async function syncToCoach() {
  const ts = new Date().toISOString();
  const date = ts.slice(0, 10); // YYYY-MM-DD

  const dayIndex = getCurrentDay();
  const day = program[dayIndex];

  const setRows = [];

  day.exercises.forEach((ex, exIndex) => {
    for (let s = 1; s <= ex.sets; s++) {
      const w = (localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-w`) || "").trim();
      const r = (localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-r`) || "").trim();

      if (w || r) {
        // Unique RowID per DATE so each session is stored (not overwritten forever)
        const rowId = `${ATHLETE}|${date}|D${dayIndex}|${day.name}|${ex.name}|set${s}`;

        setRows.push([
          rowId,
          ts,
          ATHLETE,
          day.name,
          ex.name,
          s,
          ex.reps,
          w,
          r,
        ]);
      }
    }
  });

  const payload = JSON.stringify({
    setRows,
    runRows: [],
    nutritionRows: [],
    bodyRows: [],
  });

  const el = document.getElementById("syncStatus");
  if (el) el.textContent = "Syncing…";

  try {
    await fetch(SHEETS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: "payload=" + encodeURIComponent(payload),
    });

    if (el) el.textContent = "✅ Synced. Check Google Sheet → Sets tab.";
  } catch (err) {
    console.error(err);
    if (el) el.textContent = "❌ Sync failed (check URL / deployment).";
  }
}
window.syncToCoach = syncToCoach;

// --------------------------
// OTHER TABS (placeholders)
// --------------------------
function renderRun() {

  const distance =
    localStorage.getItem("run_distance") || "";

  const time =
    localStorage.getItem("run_time") || "";

  const effort =
    localStorage.getItem("run_effort") || "Easy";

  const notes =
    localStorage.getItem("run_notes") || "";

  app.innerHTML = `
    <div class="card">
      <h2>Run Log</h2>

      <label>Distance (km)</label>
      <input id="runDistance" value="${distance}">

      <label>Time (mm:ss)</label>
      <input id="runTime" placeholder="28:30" value="${time}">

      <label>Effort</label>
      <select id="runEffort">
        <option ${effort==="Easy"?"selected":""}>Easy</option>
        <option ${effort==="Moderate"?"selected":""}>Moderate</option>
        <option ${effort==="Hard"?"selected":""}>Hard</option>
      </select>

      <label>Notes</label>
      <input id="runNotes" value="${notes}">

      <p><strong>Pace:</strong> <span id="paceDisplay">--</span></p>

      <button onclick="syncRun()">Sync Run to Coach 🏃</button>
      <p id="runSyncStatus"></p>
    </div>
  `;

  // ---------- EVENT LISTENERS (NO RE-RENDER) ----------

  const distInput = document.getElementById("runDistance");
  const timeInput = document.getElementById("runTime");
  const effortSelect = document.getElementById("runEffort");
  const notesInput = document.getElementById("runNotes");
  const paceDisplay = document.getElementById("paceDisplay");

  function updatePace() {
    const pace = calculatePace(
      distInput.value,
      timeInput.value
    );
    paceDisplay.textContent = pace || "--";
  }

  distInput.addEventListener("input", () => {
    localStorage.setItem("run_distance", distInput.value);
    updatePace();
  });

  timeInput.addEventListener("input", () => {
    localStorage.setItem("run_time", timeInput.value);
    updatePace();
  });

  effortSelect.addEventListener("change", () => {
    localStorage.setItem("run_effort", effortSelect.value);
  });

  notesInput.addEventListener("input", () => {
    localStorage.setItem("run_notes", notesInput.value);
  });

  updatePace();
}



function renderNutrition() {
  app.innerHTML = `
    <div class="card">
      <h2>Nutrition Check</h2>
      <p>Coming next step</p>
    </div>
  `;
}

function renderProgress() {
  app.innerHTML = `
    <div class="card">
      <h2>Progress</h2>
      <p>Coming next step</p>
    </div>
  `;
}
async function syncRun() {

  const ts = new Date().toISOString();
  const date = ts.slice(0,10);

  const distance =
    localStorage.getItem("run_distance") || "";

  const time =
    localStorage.getItem("run_time") || "";

  const effort =
    localStorage.getItem("run_effort") || "";

  const notes =
    localStorage.getItem("run_notes") || "";

  const pace = calculatePace(distance, time);

  if(!distance && !time) return;

  const rowId = `${ATHLETE}|RUN|${date}`;

  const runRows = [[
    rowId,
    ts,
    ATHLETE,
    distance,
    time,
    effort,
    notes,
    pace
  ]];

  const payload = JSON.stringify({
    setRows: [],
    runRows,
    nutritionRows: [],
    bodyRows: []
  });

  const el = document.getElementById("runSyncStatus");
  if(el) el.textContent = "Syncing…";

  await fetch(SHEETS_URL,{
    method:"POST",
    mode:"no-cors",
    headers:{
      "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"
    },
    body:"payload="+encodeURIComponent(payload)
  });

  if(el) el.textContent="✅ Run synced!";
}

window.syncRun = syncRun;

// INITIAL LOAD
renderToday();
