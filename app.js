// ==========================
// ALANA TRAINING APP
// WORKOUT ENGINE + LOGGING + SUGGESTIONS + COACH SYNC
// RUNS + NUTRITION + BODY + LOCAL HISTORY + PROGRESS DASHBOARD
// RUN DAY: Clean UI + Finish locked until TODAY'S run is logged
// RUN TAB: Date-based draft + clears after sync so it won't carry over
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
const SETS_LOG_KEY = "history_sets"; // set rows
const RUNS_LOG_KEY = "history_runs"; // run rows
const NUTRI_LOG_KEY = "history_nutrition"; // nutrition rows
const BODY_LOG_KEY = "history_body"; // body rows

function getLogArr(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}
function setLogArr(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}
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
  return new Date().toISOString().slice(0, 10);
}

// ==========================
// RUN SESSION STATE (DATE-BASED)
// ==========================
function runKey(date, field) {
  return `run_${date}_${field}`;
}
function todayRunDate() {
  return todayDateStr();
}
function runDoneKey(date) {
  return `run_${date}_done`;
}

function markRunDoneToday() {
  const date = todayRunDate();
  localStorage.setItem(runDoneKey(date), "1");
}

function isRunLoggedToday() {
  const date = todayRunDate();

  // ✅ if we've already synced a run today, it's done (even if draft cleared)
  if (localStorage.getItem(runDoneKey(date)) === "1") return true;

  // otherwise, treat draft as "done" only if distance+time entered (not synced yet)
  const dist = (localStorage.getItem(runKey(date, "distance")) || "").trim();
  const time = (localStorage.getItem(runKey(date, "time")) || "").trim();
  return dist !== "" && time !== "";

}
function clearRunDraftForToday() {
  const date = todayRunDate();
  localStorage.removeItem(runKey(date, "distance"));
  localStorage.removeItem(runKey(date, "time"));
  localStorage.removeItem(runKey(date, "effort"));
  localStorage.removeItem(runKey(date, "notes"));
}

// --------------------------
// PROGRAM STRUCTURE
// IMPORTANT: only the run item has type:"run"
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
      { name: "Run Session", sets: 1, reps: 1, type: "run" },
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
    exercises: [{ name: "Run Session", sets: 1, reps: 1, type: "run" }],
  },
];

// --------------------------
// NAVIGATION
// --------------------------
function showTab(tab) {
  if (tab === "today") renderToday();
  if (tab === "run") renderRun();
  if (tab === "nutrition") renderNutrition();
  if (tab === "body") renderBody();
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
// PROGRESSION SUGGESTION
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
// TODAY TAB (FIXED)
// - Only ex.type === "run" shows run card
// - Finish locked only on days that have a run exercise
// --------------------------
function renderToday() {
  const dayIndex = getCurrentDay();
  const day = program[dayIndex];

  const dayRequiresRun = day.exercises.some((ex) => ex.type === "run");
  const runComplete = !dayRequiresRun || isRunLoggedToday();

  let html = `
    <div class="card">
      <h2>Today</h2>
      <h3>${day.name}</h3>
  `;

  day.exercises.forEach((ex, exIndex) => {
    // ===== RUN SESSION UI (ONLY ON RUN ITEM) =====
    if (ex.type === "run") {
      const runDone = isRunLoggedToday();
      html += `
        <div style="
          background:${runDone ? "#e8f7ec" : "#fff7e6"};
          border:1px solid ${runDone ? "#7bd389" : "#ffc107"};
          border-radius:12px;
          padding:16px;
          margin:12px 0;
        ">
          <h4 style="margin:0 0 8px 0;">🏃 Run Session</h4>
          ${
            runDone
              ? `<p style="color:#2e7d32;margin:0 0 8px 0;">✅ Run logged for today.</p>`
              : `<p style="color:#a66b00;margin:0 0 8px 0;">Please log your run before finishing today’s workout.</p>`
          }
          <button onclick="showTab('run')" style="padding:10px 14px; cursor:pointer;">
            Go To Run Tab →
          </button>
        </div>
      `;
      return;
    }

    // ===== NORMAL STRENGTH EXERCISES =====
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
            oninput="localStorage.setItem('${weightKey}',this.value)"
          >
          <input
            placeholder="Reps"
            value="${reps}"
            oninput="localStorage.setItem('${repsKey}',this.value)"
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

      <button
        onclick="nextDay()"
        ${runComplete ? "" : "disabled"}
        style="margin-top:10px; opacity:${runComplete ? "1" : "0.5"}; cursor:${runComplete ? "pointer" : "not-allowed"};"
      >
        Finish Workout ✅
      </button>

      ${
        runComplete
          ? ""
          : `<p style="color:#a66b00; margin-top:8px;">🔒 Finish locked until today’s run is logged.</p>`
      }

      <p style="color:green;">✓ Auto saved</p>
    </div>
  `;

  app.innerHTML = html;
}

// --------------------------
// SYNC TO COACH — SETS
// --------------------------
async function syncToCoach() {
  const ts = new Date().toISOString();
  const date = ts.slice(0, 10);

  const dayIndex = getCurrentDay();
  const day = program[dayIndex];

  const setRows = [];

  day.exercises.forEach((ex, exIndex) => {
    if (ex.type === "run") return; // skip run marker

    for (let s = 1; s <= ex.sets; s++) {
      const w = (localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-w`) || "").trim();
      const r = (localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-r`) || "").trim();

      if (w || r) {
        const rowId = `${ATHLETE}|${date}|D${dayIndex}|${day.name}|${ex.name}|set${s}`;
        setRows.push([rowId, ts, ATHLETE, day.name, ex.name, s, ex.reps, w, r]);
      }
    }
  });

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

function getRunPrescription(dayName) {
  const name = (dayName || "").toLowerCase();

  // You can tweak these any time
  if (name.includes("long easy run")) {
    return {
      title: "Long Easy Run (Comfortable)",
      details: [
        "Warm-up: 5–8 min brisk walk or very easy jog",
        "Run: 3–6km at EASY pace (you can talk in sentences)",
        "Cool-down: 5 min walk + light stretching",
      ],
      effort: "Easy",
      defaultDistance: "4.0",
    };
  }

  if (name.includes("run + glutes")) {
    return {
      title: "Run Session (Quality but Controlled)",
      details: [
        "Warm-up: 5–8 min easy jog + 3 × 20 sec strides (optional)",
        "Main set (choose 1):",
        "• Option A: 10–20 min steady (Moderate, controlled breathing)",
        "• Option B: 6 × 1 min faster / 1 min easy (repeat)",
        "Cool-down: 5 min easy + stretch calves/hips",
      ],
      effort: "Moderate",
      defaultDistance: "3.0",
    };
  }

  // fallback
  return {
    title: "Run Session",
    details: [
      "Warm-up: 5–8 min easy",
      "Run: Easy–moderate effort",
      "Cool-down: 5 min walk",
    ],
    effort: "Easy",
    defaultDistance: "",
  };
}

function get12WeekRunRoadmap() {
  return [
    { weeks: "1–2", plan: "2–3 runs/week. Easy runs 2.5–3.5km. 1 session can be short intervals (1 min on/1 min easy)." },
    { weeks: "3–4", plan: "Easy runs 3–4km. Long run 4–5km. Keep effort mostly EASY." },
    { weeks: "5–6", plan: "Easy runs 3.5–4.5km. Add 10–15 min steady (moderate) once/week." },
    { weeks: "7–8", plan: "Long run 5–6km easy. 1 session/week: 6×1 min faster / 1 min easy." },
    { weeks: "9–10", plan: "Long run 5.5–6.5km easy. 1 session/week: 12–20 min steady." },
    { weeks: "11–12", plan: "5km feels comfortable. One easy run + one steady run. Week 12: 5km ‘comfortable effort’." },
  ];
}

function renderRun() {
  const dayIndex = getCurrentDay();
  const day = program[dayIndex];
  const date = todayRunDate();

  const distKey = runKey(date, "distance");
  const timeKey = runKey(date, "time");
  const effortKey = runKey(date, "effort");
  const notesKey = runKey(date, "notes");

  const prescription = getRunPrescription(day?.name || "");

  const distance = localStorage.getItem(distKey) || prescription.defaultDistance || "";
  const time = localStorage.getItem(timeKey) || "";
  const effort = localStorage.getItem(effortKey) || prescription.effort || "Easy";
  const notes = localStorage.getItem(notesKey) || "";

  const roadmap = get12WeekRunRoadmap();

  app.innerHTML = `
    <div class="card">
      <h2>Run</h2>

      <div style="background:#f7f7f7;border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0;">
        <h3 style="margin:0 0 6px 0;">Today's Run Plan</h3>
        <div style="font-weight:700;margin-bottom:6px;">${prescription.title}</div>
        <ul style="margin:0 0 0 18px; padding:0; line-height:1.6; color:#333;">
          ${prescription.details.map(x => `<li>${x}</li>`).join("")}
        </ul>
        <div style="margin-top:8px;color:#666;font-size:13px;">
          Tip: Log your run here, then go back to <strong>Today</strong> to finish the workout.
        </div>
      </div>

      <div style="border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0;">
        <h3 style="margin:0 0 8px 0;">12-Week Progression (Simple Guide)</h3>
        <div style="font-size:14px; line-height:1.55; color:#333;">
          ${roadmap.map(r => `<div style="margin:6px 0;"><strong>${r.weeks}:</strong> ${r.plan}</div>`).join("")}
        </div>
      </div>

      <label>Date</label>
      <input id="runDate" type="date" value="${date}" />

      <label>Distance (km)</label>
      <input id="runDistance" value="${distance}" inputmode="decimal" placeholder="e.g. 3.0" />

      <label>Time (mm:ss)</label>
      <input id="runTime" placeholder="e.g. 28:30" value="${time}" />

      <label>Effort</label>
      <select id="runEffort">
        <option ${effort === "Easy" ? "selected" : ""}>Easy</option>
        <option ${effort === "Moderate" ? "selected" : ""}>Moderate</option>
        <option ${effort === "Hard" ? "selected" : ""}>Hard</option>
      </select>

      <label>Notes</label>
      <input id="runNotes" value="${notes}" placeholder="How it felt / terrain / anything notable" />

      <p><strong>Pace:</strong> <span id="paceDisplay">--</span></p>

      <button onclick="syncRun()">Sync Run to Coach 🏃</button>
      <p id="runSyncStatus" style="color:#666;"></p>
    </div>
  `;

  // Elements
  const dateInput = document.getElementById("runDate");
  const distInput = document.getElementById("runDistance");
  const timeInput = document.getElementById("runTime");
  const effortSelect = document.getElementById("runEffort");
  const notesInput = document.getElementById("runNotes");
  const paceDisplay = document.getElementById("paceDisplay");

  function updatePace() {
    const pace = calculatePace(distInput.value, timeInput.value);
    paceDisplay.textContent = pace || "--";
  }

  // Date change swaps keys (history-friendly)
  dateInput.addEventListener("change", () => {
    localStorage.setItem("run_date", dateInput.value);
    renderRun();
  });

  distInput.addEventListener("input", () => {
    localStorage.setItem(runKey(todayRunDate(), "distance"), distInput.value);
    updatePace();
  });

  timeInput.addEventListener("input", () => {
    localStorage.setItem(runKey(todayRunDate(), "time"), timeInput.value);
    updatePace();
  });

  effortSelect.addEventListener("change", () => {
    localStorage.setItem(runKey(todayRunDate(), "effort"), effortSelect.value);
  });

  notesInput.addEventListener("input", () => {
    localStorage.setItem(runKey(todayRunDate(), "notes"), notesInput.value);
  });

  updatePace();
}

// --------------------------
// RUN SYNC (clears draft after sync + unlocks Today)
// --------------------------
async function syncRun() {
  const ts = new Date().toISOString();
  const date = todayRunDate();

  const distance = (localStorage.getItem(runKey(date, "distance")) || "").trim();
  const time = (localStorage.getItem(runKey(date, "time")) || "").trim();
  const effort = (localStorage.getItem(runKey(date, "effort")) || "").trim();
  const notes = (localStorage.getItem(runKey(date, "notes")) || "").trim();

  const pace = calculatePace(distance, time);
  if (!distance || !time) return;

  const rowId = `${ATHLETE}|RUN|${ts}`;
  const runRows = [[rowId, ts, ATHLETE, distance, time, effort, notes, pace]];

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
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: "payload=" + encodeURIComponent(payload),
    });

    if (el) el.textContent = "✅ Run synced!";

// ✅ Mark run as completed for today (THIS is what unlocks Finish Workout)
markRunDoneToday();

// Clear today’s draft so it DOES NOT carry over
clearRunDraftForToday();

// Refresh UI and unlock finish
renderRun();
renderToday();

  } catch (err) {
    console.error(err);
    if (el) el.textContent = "❌ Sync failed.";
  }
}
window.syncRun = syncRun;

// --------------------------
// NUTRITION TAB
// --------------------------
function renderNutrition() {
  const date = localStorage.getItem("nutri_date") || todayDateStr();
  const key = (k) => `nutri_${date}_${k}`;

  const energy = localStorage.getItem(key("energy")) || "";
  const notes = localStorage.getItem(key("notes")) || "";

  app.innerHTML = `
    <div class="card">
      <h2>Nutrition (Daily Check)</h2>

      <div style="background:#f7f7f7;border:1px solid #ddd;border-radius:12px;padding:12px;margin:12px 0;">
        <h3 style="margin:0 0 8px 0;">Today's Targets</h3>
        <strong>Protein:</strong> ${NUTRITION_TARGETS.protein_g}g<br>
        <strong>Water:</strong> ${NUTRITION_TARGETS.water_l_min}-${NUTRITION_TARGETS.water_l_max}L<br>
        <strong>Veg:</strong> ${NUTRITION_TARGETS.veg_serves}+ serves<br>
        <strong>Steps:</strong> ${NUTRITION_TARGETS.steps.toLocaleString()}+
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
        <label>Steps (number)</label>
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

  inpStepsCount.oninput = () => localStorage.setItem(key("stepsCount"), inpStepsCount.value);
  inpEnergy.oninput = () => localStorage.setItem(key("energy"), inpEnergy.value);
  inpNotes.oninput = () => localStorage.setItem(key("notes"), inpNotes.value);

  refresh();
}

// --------------------------
// NUTRITION SYNC
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

  const rowId = `${ATHLETE}|NUTRITION|${date}`;
  const nutritionRows = [[rowId, date, ATHLETE, protein, water, veg, steps, stepsCount, energy, notes, ts]];
  nutritionRows.forEach((r) => upsertRowIntoHistory(NUTRI_LOG_KEY, r));

  const payload = JSON.stringify({ setRows: [], runRows: [], nutritionRows, bodyRows: [] });

  const el = document.getElementById("nutriSyncStatus");
  if (el) el.textContent = "Syncing…";

  try {
    await fetch(SHEETS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
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
// BODY TAB + SYNC
// --------------------------
function renderBody() {
  const date = localStorage.getItem("body_date") || todayDateStr();
  const key = (k) => `body_${date}_${k}`;

  const weight = localStorage.getItem(key("weight")) || "";
  const waist = localStorage.getItem(key("waist")) || "";
  const hips = localStorage.getItem(key("hips")) || "";
  const notes = localStorage.getItem(key("notes")) || "";

  app.innerHTML = `
    <div class="card">
      <h2>Body Tracking</h2>

      <label>Date</label>
      <input id="bodyDate" type="date" value="${date}">

      <label>Bodyweight (kg)</label>
      <input id="bodyWeight" placeholder="56.0" value="${weight}">

      <label>Waist (cm)</label>
      <input id="bodyWaist" placeholder="Optional" value="${waist}">

      <label>Hips (cm)</label>
      <input id="bodyHips" placeholder="Optional" value="${hips}">

      <label>Notes</label>
      <input id="bodyNotes" placeholder="Sleep, cycle, stress etc" value="${notes}">

      <button onclick="syncBody()">Sync Body to Coach 📊</button>
      <p id="bodySyncStatus" style="color:#666;"></p>

      <p style="color:green;">✓ Auto saved</p>
    </div>
  `;

  const dateInput = document.getElementById("bodyDate");
  const weightInput = document.getElementById("bodyWeight");
  const waistInput = document.getElementById("bodyWaist");
  const hipsInput = document.getElementById("bodyHips");
  const notesInput = document.getElementById("bodyNotes");

  dateInput.addEventListener("change", () => {
    localStorage.setItem("body_date", dateInput.value);
    renderBody();
  });

  weightInput.oninput = () => localStorage.setItem(key("weight"), weightInput.value);
  waistInput.oninput = () => localStorage.setItem(key("waist"), waistInput.value);
  hipsInput.oninput = () => localStorage.setItem(key("hips"), hipsInput.value);
  notesInput.oninput = () => localStorage.setItem(key("notes"), notesInput.value);
}

async function syncBody() {
  const ts = new Date().toISOString();
  const date = localStorage.getItem("body_date") || todayDateStr();
  const key = (k) => `body_${date}_${k}`;

  const weight = (localStorage.getItem(key("weight")) || "").trim();
  const waist = (localStorage.getItem(key("waist")) || "").trim();
  const hips = (localStorage.getItem(key("hips")) || "").trim();
  const notes = (localStorage.getItem(key("notes")) || "").trim();

  if (!weight && !waist && !hips) return;

  const rowId = `${ATHLETE}|BODY|${date}`;
  const bodyRows = [[rowId, date, ATHLETE, weight, waist, hips, notes, ts]];
  bodyRows.forEach((r) => upsertRowIntoHistory(BODY_LOG_KEY, r));

  const payload = JSON.stringify({ setRows: [], runRows: [], nutritionRows: [], bodyRows });

  const el = document.getElementById("bodySyncStatus");
  if (el) el.textContent = "Syncing…";

  try {
    await fetch(SHEETS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: "payload=" + encodeURIComponent(payload),
    });
    if (el) el.textContent = "✅ Body stats synced!";
  } catch (err) {
    console.error(err);
    if (el) el.textContent = "❌ Sync failed.";
  }
}
window.syncBody = syncBody;

// --------------------------
// PROGRESS (keep your existing if you want; placeholder for now)
// --------------------------
function renderProgress() {
  app.innerHTML = `
    <div class="card">
      <h2>Progress</h2>
      <p>Charts are in your previous version — tell me if you want them back here.</p>
    </div>
  `;
}

// --------------------------
// INITIAL LOAD
// --------------------------
renderToday();
