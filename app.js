// ==========================
// ALANA TRAINING APP
// WORKOUT ENGINE + LOGGING + SUGGESTIONS + COACH SYNC
// RUNS + NUTRITION + LOCAL HISTORY + PROGRESS DASHBOARD
// ==========================

const SHEETS_URL =
  "https://script.google.com/macros/s/AKfycbw5jJ4Zk0TtCp9etm2ImxxsSqsxiLoCxZ_U50tZwE1LdqPbkw3hEan8r1YgUCgs7vJaTA/exec";

const ATHLETE = "Alana";

const NUTRITION_TARGETS = {
  protein_g: 110,
  water_l_min: 2.5,
  water_l_max: 3.0,
  veg_serves: 5,
  steps: 10000,
};

const app = document.getElementById("app");
const STORAGE_DAY = "currentTrainingDay";

// ===== LOCAL HISTORY KEYS =====
const SETS_LOG_KEY = "history_sets"; // array of set rows
const RUNS_LOG_KEY = "history_runs"; // array of run rows
const NUTRI_LOG_KEY = "history_nutrition"; // array of nutrition rows

function getLogArr(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}
function setLogArr(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}
// UPSERT into local history by RowID (row[0])
function upsertRowIntoHistory(storageKey, row) {
  const arr = getLogArr(storageKey);
  const rowId = String(row[0] || "");
  if (!rowId) return;

  const idx = arr.findIndex((r) => String(r[0]) === rowId);
  if (idx >= 0) arr[idx] = row;
  else arr.push(row);

  setLogArr(storageKey, arr);
}

// --------------------------
// TIME + PACE HELPERS
// --------------------------
function timeToMinutes(timeStr) {
  const s = String(timeStr || "").trim();
  if (!s) return null;

  if (s.includes(":")) {
    const parts = s.split(":").map((p) => p.trim());
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1] || "0");
    if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
    return mins + secs / 60;
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function calculatePace(distance, timeStr) {
  const dist = parseFloat(distance);
  const mins = timeToMinutes(timeStr);
  if (!Number.isFinite(dist) || dist <= 0 || mins == null) return "";

  const pace = mins / dist;
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
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
    const w = parseFloat(
      localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-w`)
    );
    const r = parseFloat(
      localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-r`)
    );

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
// SYNC TO COACH — SETS
// Sheet tab: "Sets"
// Columns:
// RowID | Timestamp | Athlete | DayName | Exercise | Set | TargetReps | Weight | Reps
// --------------------------
async function syncToCoach() {
  const ts = new Date().toISOString();
  const date = ts.slice(0, 10);

  const dayIndex = getCurrentDay();
  const day = program[dayIndex];

  const setRows = [];

  day.exercises.forEach((ex, exIndex) => {
    for (let s = 1; s <= ex.sets; s++) {
      const w = (
        localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-w`) || ""
      ).trim();
      const r = (
        localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-r`) || ""
      ).trim();

      if (w || r) {
        const rowId = `${ATHLETE}|${date}|D${dayIndex}|${day.name}|${ex.name}|set${s}`;
        setRows.push([rowId, ts, ATHLETE, day.name, ex.name, s, ex.reps, w, r]);
      }
    }
  });

  // Save locally for Progress graphs/history
  setRows.forEach((r) => upsertRowIntoHistory(SETS_LOG_KEY, r));

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
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
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
// RUN TAB (no re-render typing)
// --------------------------
function renderRun() {
  const distance = localStorage.getItem("run_distance") || "";
  const time = localStorage.getItem("run_time") || "";
  const effort = localStorage.getItem("run_effort") || "Easy";
  const notes = localStorage.getItem("run_notes") || "";

  app.innerHTML = `
    <div class="card">
      <h2>Run Log</h2>

      <label>Distance (km)</label>
      <input id="runDistance" value="${distance}">

      <label>Time (mm:ss)</label>
      <input id="runTime" placeholder="28:30" value="${time}">

      <label>Effort</label>
      <select id="runEffort">
        <option ${effort === "Easy" ? "selected" : ""}>Easy</option>
        <option ${effort === "Moderate" ? "selected" : ""}>Moderate</option>
        <option ${effort === "Hard" ? "selected" : ""}>Hard</option>
      </select>

      <label>Notes</label>
      <input id="runNotes" value="${notes}">

      <p><strong>Pace:</strong> <span id="paceDisplay">--</span></p>

      <button onclick="syncRun()">Sync Run to Coach 🏃</button>
      <p id="runSyncStatus" style="color:#666;"></p>
    </div>
  `;

  const distInput = document.getElementById("runDistance");
  const timeInput = document.getElementById("runTime");
  const effortSelect = document.getElementById("runEffort");
  const notesInput = document.getElementById("runNotes");
  const paceDisplay = document.getElementById("paceDisplay");

  function updatePace() {
    const pace = calculatePace(distInput.value, timeInput.value);
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

// --------------------------
// RUN SYNC (history rows, never overwrite)
// Sheet tab: "Runs"
// Headers recommended:
// RowID | Timestamp | Athlete | DistanceKm | Time | Effort | Notes | Pace
// --------------------------
async function syncRun() {
  const ts = new Date().toISOString();

  const distance = localStorage.getItem("run_distance") || "";
  const time = localStorage.getItem("run_time") || "";
  const effort = localStorage.getItem("run_effort") || "";
  const notes = localStorage.getItem("run_notes") || "";

  const pace = calculatePace(distance, time);
  if (!distance && !time) return;

  // UNIQUE RowID so each run is stored historically
  const rowId = `${ATHLETE}|RUN|${ts}`;

  const runRows = [[rowId, ts, ATHLETE, distance, time, effort, notes, pace]];

  // Save locally for Progress graphs/history
  runRows.forEach((r) => upsertRowIntoHistory(RUNS_LOG_KEY, r));

  const payload = JSON.stringify({
    setRows: [],
    runRows,
    nutritionRows: [],
    bodyRows: [],
  });

  const el = document.getElementById("runSyncStatus");
  if (el) el.textContent = "Syncing…";

  try {
    await fetch(SHEETS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: "payload=" + encodeURIComponent(payload),
    });
    if (el) el.textContent = "✅ Run synced!";
  } catch (err) {
    console.error(err);
    if (el) el.textContent = "❌ Sync failed.";
  }
}
window.syncRun = syncRun;

// --------------------------
// NUTRITION TAB (daily habits + steps)
// --------------------------
function renderNutrition() {
  const date = localStorage.getItem("nutri_date") || todayDateStr();
  const key = (k) => `nutri_${date}_${k}`;

  const energy = localStorage.getItem(key("energy")) || "";
  const notes = localStorage.getItem(key("notes")) || "";

  app.innerHTML = `
    <div class="card">
      <h2>Nutrition (Daily Check)</h2>

      <!-- TARGETS -->
      <div style="background:#f7f7f7;border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0;">
        <h3 style="margin:0 0 8px 0;">Today's Targets</h3>

        <strong>Protein:</strong> ${NUTRITION_TARGETS.protein_g}g<br>
        <small style="color:#555;">Protein every meal + snack</small><br><br>

        <strong>Water:</strong> ${NUTRITION_TARGETS.water_l_min}-${NUTRITION_TARGETS.water_l_max}L<br>
        <small style="color:#555;">Add extra on run days</small><br><br>

        <strong>Veg:</strong> ${NUTRITION_TARGETS.veg_serves}+ serves<br>
        <small style="color:#555;">2 fists veg lunch + dinner</small><br><br>

        <strong>Steps:</strong> ${NUTRITION_TARGETS.steps.toLocaleString()}+
      </div>

      <!-- PROTEIN CHEATSHEET -->
      <div style="background:#fff;border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0;">
        <h3 style="margin:0 0 8px 0;">Protein Cheatsheet 🍗</h3>

        <div style="line-height:1.6;color:#444;">
          <strong>≈30g protein examples:</strong><br>
          ✅ 150g chicken breast<br>
          ✅ 200g Greek yogurt<br>
          ✅ Whey shake + milk<br>
          ✅ 4 eggs + egg whites<br>
          ✅ 150g lean beef<br>
          ✅ Tuna + rice cakes<br><br>

          <small style="color:#666;">
            Goal = ~4 protein feeds/day → hits ${NUTRITION_TARGETS.protein_g}g automatically.
          </small>
        </div>
      </div>

      <label>Date</label>
      <input id="nutriDate" type="date" value="${date}" />

      <hr style="margin:12px 0;">

      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button id="btnProtein" type="button"></button>
        <button id="btnWater" type="button"></button>
        <button id="btnVeg" type="button"></button>
        <button id="btnSteps" type="button"></button>
      </div>

      <div style="margin-top:12px;">
        <label>Steps (optional number)</label>
        <input id="nutriStepsCount" placeholder="e.g. 10350">
      </div>

      <div style="margin-top:12px;">
        <label>Energy (1–5)</label>
        <input id="nutriEnergy" inputmode="numeric" placeholder="1–5" value="${energy}">
      </div>

      <div style="margin-top:8px;">
        <label>Notes</label>
        <input id="nutriNotes" placeholder="Hunger/sleep/stress etc" value="${notes}">
      </div>

      <div style="margin-top:12px;">
        <button onclick="syncNutrition()">Sync Nutrition to Coach 🍎</button>
        <p id="nutriSyncStatus" style="color:#666;"></p>
      </div>

      <p style="color:green;">✓ Auto saved</p>
    </div>
  `;

  const nutriDate = document.getElementById("nutriDate");
  const btnProtein = document.getElementById("btnProtein");
  const btnWater = document.getElementById("btnWater");
  const btnVeg = document.getElementById("btnVeg");
  const btnSteps = document.getElementById("btnSteps");

  const inpStepsCount = document.getElementById("nutriStepsCount");
  const inpEnergy = document.getElementById("nutriEnergy");
  const inpNotes = document.getElementById("nutriNotes");

  function setBtn(btn, label, val) {
    const yes = val === "Yes";
    btn.textContent = `${label} ${yes ? "✅" : "❌"}`;
    btn.style.background = yes ? "#111" : "#fff";
    btn.style.color = yes ? "#fff" : "#111";
    btn.style.border = "1px solid #111";
  }

  function toggle(field) {
    const cur = localStorage.getItem(key(field)) || "No";
    localStorage.setItem(key(field), cur === "Yes" ? "No" : "Yes");
    refresh();
  }

  function refresh() {
    setBtn(btnProtein, "Protein", localStorage.getItem(key("protein")) || "No");
    setBtn(btnWater, "Water", localStorage.getItem(key("water")) || "No");
    setBtn(btnVeg, "Veg", localStorage.getItem(key("veg")) || "No");
    setBtn(btnSteps, "Steps", localStorage.getItem(key("steps")) || "No");

    inpStepsCount.value = localStorage.getItem(key("stepsCount")) || "";
  }

  nutriDate.addEventListener("change", () => {
    localStorage.setItem("nutri_date", nutriDate.value);
    renderNutrition();
  });

  btnProtein.onclick = () => toggle("protein");
  btnWater.onclick = () => toggle("water");
  btnVeg.onclick = () => toggle("veg");
  btnSteps.onclick = () => toggle("steps");

  inpStepsCount.oninput = () =>
    localStorage.setItem(key("stepsCount"), inpStepsCount.value);

  inpEnergy.oninput = () => localStorage.setItem(key("energy"), inpEnergy.value);
  inpNotes.oninput = () => localStorage.setItem(key("notes"), inpNotes.value);

  refresh();
}

// --------------------------
// NUTRITION SYNC
// Sheet tab: "Nutrition"
// Headers recommended:
// RowID | Date | Athlete | Protein | Water | Veg | Steps | StepsCount | Energy | Notes | Timestamp
// --------------------------
async function syncNutrition() {
  const ts = new Date().toISOString();
  const date = localStorage.getItem("nutri_date") || todayDateStr();
  const key = (k) => `nutri_${date}_${k}`;

  const protein = localStorage.getItem(key("protein")) || "No";
  const water = localStorage.getItem(key("water")) || "No";
  const veg = localStorage.getItem(key("veg")) || "No";
  const steps = localStorage.getItem(key("steps")) || "No";
  const stepsCount = (localStorage.getItem(key("stepsCount")) || "").trim();
  const energy = (localStorage.getItem(key("energy")) || "").trim();
  const notes = (localStorage.getItem(key("notes")) || "").trim();

  // One row per day (edits update that day)
  const rowId = `${ATHLETE}|NUTRITION|${date}`;

  const nutritionRows = [
    [
      rowId,
      date,
      ATHLETE,
      protein,
      water,
      veg,
      steps,
      stepsCount,
      energy,
      notes,
      ts,
    ],
  ];

  // Save locally for Progress graphs/history
  nutritionRows.forEach((r) => upsertRowIntoHistory(NUTRI_LOG_KEY, r));

  const payload = JSON.stringify({
    setRows: [],
    runRows: [],
    nutritionRows,
    bodyRows: [],
  });

  const el = document.getElementById("nutriSyncStatus");
  if (el) el.textContent = "Syncing…";

  try {
    await fetch(SHEETS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: "payload=" + encodeURIComponent(payload),
    });

    if (el) el.textContent = "✅ Nutrition synced!";
  } catch (err) {
    console.error(err);
    if (el) el.textContent = "❌ Sync failed.";
  }
}
window.syncNutrition = syncNutrition;

// --------------------------
// PROGRESS TAB (Summary + Charts)
// --------------------------
function loadChartJs() {
  return new Promise((resolve, reject) => {
    if (window.Chart) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
    s.onload = resolve;
    s.onerror = () => reject(new Error("Chart.js failed to load"));
    document.head.appendChild(s);
  });
}

function lastNDates(n) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d);
    x.setDate(d.getDate() - i);
    out.push(x.toISOString().slice(0, 10));
  }
  return out.reverse();
}

let runChartInst = null;
let strengthChartInst = null;

function renderProgress() {
  app.innerHTML = `
    <div class="card">
      <h2>Progress</h2>

      <div style="background:#f7f7f7;border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0;">
        <h3 style="margin:0 0 8px 0;">Last 7 Days (Habits)</h3>
        <div id="habitSummary" style="line-height:1.7;color:#333;"></div>
      </div>

      <div style="border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0;">
        <h3 style="margin:0 0 8px 0;">Run Pace Trend</h3>
        <canvas id="runPaceChart" height="180"></canvas>
      </div>

      <div style="border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0;">
        <h3 style="margin:0 0 8px 0;">Strength Trend</h3>
        <label>Select exercise</label>
        <select id="exSelect" style="padding:8px;min-width:220px;"></select>
        <canvas id="strengthChart" height="180" style="margin-top:10px;"></canvas>
      </div>

      <p style="color:#666;font-size:13px;">
        Tip: If charts look empty, do 1 sync for Sets/Run/Nutrition so history is stored.
      </p>
    </div>
  `;

  renderHabitSummary();
  renderCharts();
}

function renderHabitSummary() {
  const dates = lastNDates(7);
  const keyFor = (date, k) => `nutri_${date}_${k}`;

  let proteinYes = 0,
    waterYes = 0,
    vegYes = 0,
    stepsYes = 0;

  dates.forEach((date) => {
    if ((localStorage.getItem(keyFor(date, "protein")) || "No") === "Yes")
      proteinYes++;
    if ((localStorage.getItem(keyFor(date, "water")) || "No") === "Yes")
      waterYes++;
    if ((localStorage.getItem(keyFor(date, "veg")) || "No") === "Yes") vegYes++;
    if ((localStorage.getItem(keyFor(date, "steps")) || "No") === "Yes")
      stepsYes++;
  });

  const el = document.getElementById("habitSummary");
  if (!el) return;

  el.innerHTML = `
    Protein: <strong>${proteinYes}/7</strong><br>
    Water: <strong>${waterYes}/7</strong><br>
    Veg: <strong>${vegYes}/7</strong><br>
    Steps: <strong>${stepsYes}/7</strong>
  `;
}

async function renderCharts() {
  try {
    await loadChartJs();
  } catch (e) {
    console.error(e);
    return;
  }

  // ===== RUN PACE CHART =====
  const runRows = getLogArr(RUNS_LOG_KEY);
  // RowID, Timestamp, Athlete, DistanceKm, Time, Effort, Notes, Pace
  const runLabels = runRows.map((r) => String(r[1] || "").slice(0, 10));
  const runPaceMin = runRows.map((r) => {
    const dist = parseFloat(r[3]);
    const mins = timeToMinutes(r[4]);
    if (!dist || mins == null) return null;
    return mins / dist;
  });

  const runCtx = document.getElementById("runPaceChart")?.getContext("2d");
  if (runCtx) {
    if (runChartInst) runChartInst.destroy();
    runChartInst = new Chart(runCtx, {
      type: "line",
      data: {
        labels: runLabels,
        datasets: [
          {
            label: "Pace (min/km)",
            data: runPaceMin,
            spanGaps: true,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
      },
    });
  }

  // ===== STRENGTH CHART =====
  const exSelect = document.getElementById("exSelect");
  if (!exSelect) return;

  const names = [];
  program.forEach((day) =>
    day.exercises.forEach((ex) => {
      if (!names.includes(ex.name) && ex.sets > 1) names.push(ex.name);
    })
  );

  exSelect.innerHTML = names
    .map((n) => `<option value="${n}">${n}</option>`)
    .join("");
  exSelect.value = exSelect.value || names[0] || "";

  function drawStrength(exName) {
    const setRows = getLogArr(SETS_LOG_KEY);
    // RowID, Timestamp, Athlete, DayName, Exercise, Set, TargetReps, Weight, Reps

    const map = new Map(); // date -> {sum,count}
    setRows.forEach((r) => {
      if (String(r[4]) !== exName) return;
      const date = String(r[1] || "").slice(0, 10);
      const w = parseFloat(r[7]);
      if (!date || !Number.isFinite(w)) return;

      if (!map.has(date)) map.set(date, { sum: 0, count: 0 });
      const o = map.get(date);
      o.sum += w;
      o.count += 1;
    });

    const dates = [...map.keys()].sort();
    const avg = dates.map((d) => {
      const o = map.get(d);
      return o.count ? o.sum / o.count : null;
    });

    const ctx = document.getElementById("strengthChart")?.getContext("2d");
    if (!ctx) return;

    if (strengthChartInst) strengthChartInst.destroy();
    strengthChartInst = new Chart(ctx, {
      type: "line",
      data: {
        labels: dates,
        datasets: [
          {
            label: `${exName} avg weight (kg)`,
            data: avg,
            spanGaps: true,
            tension: 0.25,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: true } },
      },
    });
  }

  drawStrength(exSelect.value);
  exSelect.addEventListener("change", () => drawStrength(exSelect.value));
}

// --------------------------
// INITIAL LOAD
// --------------------------
renderToday();
