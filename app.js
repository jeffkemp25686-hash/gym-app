// app.js
// ==========================
// ALANA TRAINING APP (REACT SINGLE-FILE)
// WORKOUT ENGINE + SET LOGGING + SUGGESTIONS + REST TIMER
// RUNS (with prescription + unlock) + NUTRITION (targets + steps) + BODY
// LOCAL HISTORY + PROGRESS CHARTS (Chart.js)
// COACH SYNC via Google Apps Script (payload=...)
// ==========================

import React, { useEffect, useMemo, useRef, useState } from "react";

// ===== CONFIG =====
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

const STORAGE_DAY = "currentTrainingDay";

// ===== LOCAL HISTORY KEYS =====
const SETS_LOG_KEY = "history_sets"; // set rows
const RUNS_LOG_KEY = "history_runs"; // run rows
const NUTRI_LOG_KEY = "history_nutrition"; // nutrition rows
const BODY_LOG_KEY = "history_body"; // body rows

// ==========================
// DATE/TIME HELPERS
// ==========================
function todayDateStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

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

// ==========================
// STORAGE HELPERS
// ==========================
function getLogArr(key) {
  return JSON.parse(localStorage.getItem(key) || "[]");
}
function setLogArr(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}
function upsertRowIntoHistory(storageKey, row) {
  const arr = getLogArr(storageKey);
  const rowId = String(row?.[0] || "");
  if (!rowId) return;

  const idx = arr.findIndex((r) => String(r?.[0]) === rowId);
  if (idx >= 0) arr[idx] = row;
  else arr.push(row);

  setLogArr(storageKey, arr);
}

function useLocalStorageState(key, initialValue) {
  const [value, setValue] = useState(() => {
    const raw = localStorage.getItem(key);
    if (raw == null) return initialValue;
    try {
      return JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

// ==========================
// PROGRAM (6 DAYS + 1 ACTIVE REST)
// ==========================
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
      { name: "RUN_SESSION", sets: 1, reps: 1 },
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
    exercises: [{ name: "RUN_LONG", sets: 1, reps: 1 }],
  },
];

// ==========================
// DAY TRACKING
// ==========================
function getCurrentDay() {
  let day = localStorage.getItem(STORAGE_DAY);
  if (!day) {
    day = "0";
    localStorage.setItem(STORAGE_DAY, day);
  }
  return parseInt(day, 10);
}

function setCurrentDay(n) {
  localStorage.setItem(STORAGE_DAY, String(n));
}

// ==========================
// REST TIMER (60s) — per exercise
// ==========================
function useRestTimers() {
  const [timers, setTimers] = useState({}); // key -> secondsRemaining

  useEffect(() => {
    const id = setInterval(() => {
      setTimers((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (next[k] > 0) {
            next[k] = next[k] - 1;
            changed = true;
          }
          if (next[k] <= 0) {
            delete next[k];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const start = (key) => setTimers((t) => ({ ...t, [key]: 60 }));
  const remaining = (key) => timers[key] ?? 0;

  return { start, remaining };
}

// ==========================
// SET SUGGESTIONS (from today’s stored values)
// ==========================
function getSuggestion(dayIndex, exIndex, targetReps) {
  let totalWeight = 0;
  let totalReps = 0;
  let setsLogged = 0;

  for (let s = 1; s <= 6; s++) {
    const w = parseFloat(localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-w`));
    const r = parseFloat(localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-r`));
    if (!Number.isNaN(w) && !Number.isNaN(r)) {
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

// ==========================
// RUN SESSION STATE + LOCKING
// ==========================
function todayRunDate() {
  return localStorage.getItem("run_date") || todayDateStr();
}

function runKey(date, field) {
  return `run_${date}_${field}`;
}

function clearRunDraftForToday() {
  const date = todayRunDate();
  localStorage.removeItem(runKey(date, "distance"));
  localStorage.removeItem(runKey(date, "time"));
  localStorage.removeItem(runKey(date, "effort"));
  localStorage.removeItem(runKey(date, "notes"));
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

  if (localStorage.getItem(runDoneKey(date)) === "1") return true;

  const dist = (localStorage.getItem(runKey(date, "distance")) || "").trim();
  const time = (localStorage.getItem(runKey(date, "time")) || "").trim();
  return dist !== "" && time !== "";
}

function todayRequiresRun(dayObj) {
  if (!dayObj) return false;
  const dn = String(dayObj.name || "").toLowerCase();
  if (dn.includes("run")) return true;
  return (dayObj.exercises || []).some((ex) => String(ex.name).toUpperCase().startsWith("RUN_"));
}

// ==========================
// RUN PRESCRIPTION
// ==========================
function getRunPrescription(dayName) {
  const name = String(dayName || "").toLowerCase();

  if (name.includes("long easy run")) {
    return {
      title: "Long Easy Run (Comfortable)",
      details: [
        "Warm-up: 5–8 min brisk walk or very easy jog",
        "Run: 3–6km EASY pace (you can talk in sentences)",
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
        "Warm-up: 5–8 min easy jog",
        "Main set: 6 × 1 min faster / 1 min easy (repeat)",
        "Cool-down: 5 min easy + stretch calves/hips",
      ],
      effort: "Moderate",
      defaultDistance: "3.0",
    };
  }

  return {
    title: "Run Session",
    details: ["Warm-up 5 min", "Run easy–moderate", "Cool-down 5 min walk"],
    effort: "Easy",
    defaultDistance: "",
  };
}

// ==========================
// COACH SYNC (Apps Script payload=...)
// ==========================
async function postPayload(payloadObj) {
  const payload = JSON.stringify(payloadObj);
  await fetch(SHEETS_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: "payload=" + encodeURIComponent(payload),
  });
}

// ==========================
// CHART.JS LOADER
// ==========================
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

// ==========================
// APP
// ==========================

export default function App() {
  const [tab, setTab] = useLocalStorageState("alana.tab", "today");
  const [dayIndex, setDayIndex] = useState(() => getCurrentDay());

  // keep localStorage in sync
  useEffect(() => {
    setCurrentDay(dayIndex);
  }, [dayIndex]);

  const day = program[dayIndex];
  const needsRun = todayRequiresRun(day);
  const runDone = !needsRun ? true : isRunLoggedToday();

  return (
    <div style={styles.page}>
      <Header day={day} dayIndex={dayIndex} setDayIndex={setDayIndex} />

      <div style={styles.tabs}>
        <Tab id="today" label="Today" tab={tab} setTab={setTab} />
        <Tab id="run" label="Run" tab={tab} setTab={setTab} />
        <Tab id="nutrition" label="Nutrition" tab={tab} setTab={setTab} />
        <Tab id="body" label="Body" tab={tab} setTab={setTab} />
        <Tab id="progress" label="Progress" tab={tab} setTab={setTab} />
      </div>

      <div style={{ marginTop: 14 }}>
        {tab === "today" && (
          <TodayTab
            day={day}
            dayIndex={dayIndex}
            needsRun={needsRun}
            runDone={runDone}
            goRun={() => setTab("run")}
            finish={() => setDayIndex((d) => (d + 1) % program.length)}
          />
        )}
        {tab === "run" && <RunTab day={day} onUnlock={() => {}} />}
        {tab === "nutrition" && <NutritionTab />}
        {tab === "body" && <BodyTab />}
        {tab === "progress" && <ProgressTab />}
      </div>

      <div style={styles.footer}>
        <div style={{ opacity: 0.7 }}>
          Athlete: <b>{ATHLETE}</b>
        </div>
        <div style={{ opacity: 0.7 }}>Local storage + coach sync</div>
      </div>
    </div>
  );
}

function Header({ day, dayIndex, setDayIndex }) {
  return (
    <div style={styles.header}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 900 }}>Alana Training</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Day {dayIndex + 1}/{program.length}: <b>{day?.name}</b>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          style={styles.ghostBtn}
          onClick={() => setDayIndex((d) => (d - 1 + program.length) % program.length)}
        >
          ◀ Prev
        </button>
        <button
          style={styles.ghostBtn}
          onClick={() => setDayIndex((d) => (d + 1) % program.length)}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
}

function Tab({ id, label, tab, setTab }) {
  const active = tab === id;
  return (
    <button
      onClick={() => setTab(id)}
      style={{ ...styles.tabBtn, ...(active ? styles.tabBtnActive : null) }}
    >
      {label}
    </button>
  );
}

// ==========================
// TODAY TAB
// ==========================

function TodayTab({ day, dayIndex, needsRun, runDone, goRun, finish }) {
  const { start, remaining } = useRestTimers();
  const [syncStatus, setSyncStatus] = useState("");

  const onSyncSets = async () => {
    const ts = new Date().toISOString();
    const date = ts.slice(0, 10);

    const setRows = [];

    (day.exercises || []).forEach((ex, exIndex) => {
      const exName = String(ex.name || "");
      if (exName.toUpperCase().startsWith("RUN_")) return;

      for (let s = 1; s <= ex.sets; s++) {
        const w = (localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-w`) || "").trim();
        const r = (localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-r`) || "").trim();
        if (w || r) {
          const rowId = `${ATHLETE}|${date}|D${dayIndex}|${day.name}|${ex.name}|set${s}`;
          setRows.push([rowId, ts, ATHLETE, day.name, ex.name, s, ex.reps, w, r]);
        }
      }
    });

    setRows.forEach((row) => upsertRowIntoHistory(SETS_LOG_KEY, row));

    setSyncStatus("Syncing…");
    try {
      await postPayload({ setRows, runRows: [], nutritionRows: [], bodyRows: [] });
      setSyncStatus("✅ Synced. Check Google Sheet → Sets tab.");
    } catch (e) {
      console.error(e);
      setSyncStatus("❌ Sync failed (check URL / deployment).");
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={{ margin: 0 }}>Today</h2>
      <h3 style={{ marginTop: 8 }}>{day?.name}</h3>

      {needsRun ? (
        <div style={styles.runAlert}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>🏃 Run Session</div>
          <div style={{ color: "#7a5a12", marginBottom: 10 }}>
            Please log your run before finishing today’s workout.
          </div>
          <button style={styles.ghostBtn} onClick={goRun}>
            Go To Run Tab →
          </button>
          <div style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
            Status: {runDone ? "✅ Run logged" : "❌ Not logged yet"}
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
        {(day.exercises || []).map((ex, exIndex) => {
          const exName = String(ex.name || "");
          if (exName.toUpperCase().startsWith("RUN_")) return null;

          const suggestion = getSuggestion(dayIndex, exIndex, ex.reps);
          const restKey = `rest-${dayIndex}-${exIndex}`;
          const restLeft = remaining(restKey);

          return (
            <div key={`${exIndex}-${ex.name}`} style={styles.subCard}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{ex.name}</div>
                  <div style={{ opacity: 0.7, fontSize: 13 }}>
                    {ex.sets} × {ex.reps}
                    {suggestion ? ` • Suggested next time: ${suggestion} kg` : ""}
                  </div>
                </div>
                <button
                  style={styles.ghostBtn}
                  onClick={() => start(restKey)}
                  disabled={restLeft > 0}
                  title="60s rest timer"
                >
                  {restLeft > 0 ? `Rest ${restLeft}s` : "Start 60s Rest"}
                </button>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                {Array.from({ length: ex.sets }).map((_, i) => {
                  const s = i + 1;
                  const weightKey = `d${dayIndex}-e${exIndex}-s${s}-w`;
                  const repsKey = `d${dayIndex}-e${exIndex}-s${s}-r`;

                  const weight = localStorage.getItem(weightKey) || "";
                  const reps = localStorage.getItem(repsKey) || "";

                  return (
                    <div key={`${exIndex}-set-${s}`} style={styles.row3}>
                      <div style={{ opacity: 0.7, fontSize: 13 }}>Set {s}</div>
                      <input
                        style={styles.input}
                        placeholder="Weight"
                        defaultValue={weight}
                        onChange={(e) => localStorage.setItem(weightKey, e.target.value)}
                      />
                      <input
                        style={styles.input}
                        placeholder="Reps"
                        defaultValue={reps}
                        onChange={(e) => localStorage.setItem(repsKey, e.target.value)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button style={styles.primaryBtn} onClick={onSyncSets}>
          Sync to Coach ✅
        </button>
        <button
          style={{ ...styles.primaryBtn, opacity: runDone ? 1 : 0.55 }}
          onClick={finish}
          disabled={!runDone}
        >
          Finish Workout ✅
        </button>
      </div>

      {syncStatus ? <div style={{ marginTop: 8, color: "#666" }}>{syncStatus}</div> : null}

      <div style={{ marginTop: 10, color: runDone ? "#2e7d32" : "#b26a00" }}>
        {runDone ? "✅ Ready to finish." : "🔒 Finish locked until today’s run is logged."}
      </div>
      <div style={{ marginTop: 8, color: "#2e7d32", fontWeight: 800 }}>✓ Auto saved</div>
    </div>
  );
}

// ==========================
// RUN TAB
// ==========================

function RunTab({ day }) {
  const [date, setDate] = useState(() => todayRunDate());
  const prescription = useMemo(() => getRunPrescription(day?.name || ""), [day?.name]);

  const [distance, setDistance] = useState(() =>
    localStorage.getItem(runKey(date, "distance")) || prescription.defaultDistance || ""
  );
  const [time, setTime] = useState(() => localStorage.getItem(runKey(date, "time")) || "");
  const [effort, setEffort] = useState(
    () => localStorage.getItem(runKey(date, "effort")) || prescription.effort || "Easy"
  );
  const [notes, setNotes] = useState(() => localStorage.getItem(runKey(date, "notes")) || "");
  const [status, setStatus] = useState("");

  useEffect(() => {
    localStorage.setItem("run_date", date);
    // reload values for date
    setDistance(localStorage.getItem(runKey(date, "distance")) || prescription.defaultDistance || "");
    setTime(localStorage.getItem(runKey(date, "time")) || "");
    setEffort(localStorage.getItem(runKey(date, "effort")) || prescription.effort || "Easy");
    setNotes(localStorage.getItem(runKey(date, "notes")) || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  useEffect(() => {
    localStorage.setItem(runKey(date, "distance"), distance);
  }, [date, distance]);
  useEffect(() => {
    localStorage.setItem(runKey(date, "time"), time);
  }, [date, time]);
  useEffect(() => {
    localStorage.setItem(runKey(date, "effort"), effort);
  }, [date, effort]);
  useEffect(() => {
    localStorage.setItem(runKey(date, "notes"), notes);
  }, [date, notes]);

  const pace = useMemo(() => calculatePace(distance, time), [distance, time]);

  const onSync = async () => {
    const ts = new Date().toISOString();

    const dist = String(distance || "").trim();
    const t = String(time || "").trim();

    if (!dist || !t) {
      setStatus("Please enter both distance and time first.");
      return;
    }

    const rowId = `${ATHLETE}|RUN|${ts}`;
    const runRows = [[rowId, ts, ATHLETE, dist, t, effort, String(notes || "").trim(), pace]];
    runRows.forEach((r) => upsertRowIntoHistory(RUNS_LOG_KEY, r));

    setStatus("Syncing…");
    try {
      await postPayload({ setRows: [], runRows, nutritionRows: [], bodyRows: [] });
      setStatus("✅ Run synced!");
      markRunDoneToday();
      clearRunDraftForToday();

      // clear UI draft after sync
      setDistance("");
      setTime("");
      setNotes("");
    } catch (e) {
      console.error(e);
      setStatus("❌ Sync failed.");
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={{ margin: 0 }}>Run</h2>

      <div style={styles.planBox}>
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Today's Run Plan</div>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>{prescription.title}</div>
        <ul style={{ margin: "0 0 0 18px", padding: 0, lineHeight: 1.6, color: "#333" }}>
          {prescription.details.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <div style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
          Log your run here, then go back to <b>Today</b> to finish the workout.
        </div>
      </div>

      <div style={styles.grid2}>
        <Labeled label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
        </Labeled>
        <Labeled label="Effort">
          <select value={effort} onChange={(e) => setEffort(e.target.value)} style={styles.input}>
            <option>Easy</option>
            <option>Moderate</option>
            <option>Hard</option>
          </select>
        </Labeled>
      </div>

      <div style={styles.grid2}>
        <Labeled label="Distance (km)">
          <input value={distance} onChange={(e) => setDistance(e.target.value)} inputMode="decimal" placeholder="e.g. 3.0" style={styles.input} />
        </Labeled>
        <Labeled label="Time (mm:ss)">
          <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. 28:30" style={styles.input} />
        </Labeled>
      </div>

      <Labeled label="Notes">
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How it felt / terrain / anything notable" style={styles.input} />
      </Labeled>

      <div style={{ marginTop: 10 }}>
        <b>Pace:</b> {pace || "--"}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button style={styles.primaryBtn} onClick={onSync}>
          Sync Run to Coach 🏃
        </button>
      </div>

      {status ? <div style={{ marginTop: 8, color: "#666" }}>{status}</div> : null}

      <div style={{ marginTop: 10, color: "#2e7d32", fontWeight: 800 }}>✓ Auto saved</div>
    </div>
  );
}

// ==========================
// NUTRITION TAB
// ==========================

function NutritionTab() {
  const [date, setDate] = useState(() => localStorage.getItem("nutri_date") || todayDateStr());
  const key = (k) => `nutri_${date}_${k}`;

  const [energy, setEnergy] = useState(() => localStorage.getItem(key("energy")) || "");
  const [notes, setNotes] = useState(() => localStorage.getItem(key("notes")) || "");
  const [stepsCount, setStepsCount] = useState(() => localStorage.getItem(key("stepsCount")) || "");

  const getYesNo = (field) => localStorage.getItem(key(field)) || "No";
  const [protein, setProtein] = useState(() => getYesNo("protein"));
  const [water, setWater] = useState(() => getYesNo("water"));
  const [veg, setVeg] = useState(() => getYesNo("veg"));
  const [steps, setSteps] = useState(() => getYesNo("steps"));

  const [status, setStatus] = useState("");

  // when date changes, reload from storage
  useEffect(() => {
    localStorage.setItem("nutri_date", date);

    const k = (x) => `nutri_${date}_${x}`;
    setEnergy(localStorage.getItem(k("energy")) || "");
    setNotes(localStorage.getItem(k("notes")) || "");
    setStepsCount(localStorage.getItem(k("stepsCount")) || "");
    setProtein(localStorage.getItem(k("protein")) || "No");
    setWater(localStorage.getItem(k("water")) || "No");
    setVeg(localStorage.getItem(k("veg")) || "No");
    setSteps(localStorage.getItem(k("steps")) || "No");
  }, [date]);

  useEffect(() => localStorage.setItem(key("energy"), energy), [date, energy]);
  useEffect(() => localStorage.setItem(key("notes"), notes), [date, notes]);
  useEffect(() => localStorage.setItem(key("stepsCount"), stepsCount), [date, stepsCount]);
  useEffect(() => localStorage.setItem(key("protein"), protein), [date, protein]);
  useEffect(() => localStorage.setItem(key("water"), water), [date, water]);
  useEffect(() => localStorage.setItem(key("veg"), veg), [date, veg]);
  useEffect(() => localStorage.setItem(key("steps"), steps), [date, steps]);

  const toggle = (field, val, setVal) => {
    setVal(val === "Yes" ? "No" : "Yes");
  };

  const onSync = async () => {
    const ts = new Date().toISOString();
    const rowId = `${ATHLETE}|NUTRITION|${date}`;

    const nutritionRows = [[
      rowId,
      date,
      ATHLETE,
      protein,
      water,
      veg,
      steps,
      String(stepsCount || "").trim(),
      String(energy || "").trim(),
      String(notes || "").trim(),
      ts,
    ]];

    nutritionRows.forEach((r) => upsertRowIntoHistory(NUTRI_LOG_KEY, r));

    setStatus("Syncing…");
    try {
      await postPayload({ setRows: [], runRows: [], nutritionRows, bodyRows: [] });
      setStatus("✅ Nutrition synced!");
    } catch (e) {
      console.error(e);
      setStatus("❌ Sync failed.");
    }
  };

  const btnStyle = (yes) => ({
    ...styles.toggleBtn,
    background: yes ? "#111" : "#fff",
    color: yes ? "#fff" : "#111",
  });

  return (
    <div style={styles.card}>
      <h2 style={{ margin: 0 }}>Nutrition (Daily Check)</h2>

      <div style={styles.planBox}>
        <h3 style={{ margin: "0 0 8px 0" }}>Today's Targets</h3>
        <b>Protein:</b> {NUTRITION_TARGETS.protein_g}g<br />
        <small style={{ color: "#555" }}>Protein every meal + snack</small>
        <br />
        <br />
        <b>Water:</b> {NUTRITION_TARGETS.water_l_min}-{NUTRITION_TARGETS.water_l_max}L<br />
        <small style={{ color: "#555" }}>Add extra on run days</small>
        <br />
        <br />
        <b>Veg:</b> {NUTRITION_TARGETS.veg_serves}+ serves<br />
        <small style={{ color: "#555" }}>2 fists veg lunch + dinner</small>
        <br />
        <br />
        <b>Steps:</b> {NUTRITION_TARGETS.steps.toLocaleString()}+
      </div>

      <div style={styles.planBox}>
        <h3 style={{ margin: "0 0 8px 0" }}>Protein Cheatsheet 🍗</h3>
        <div style={{ lineHeight: 1.6, color: "#444" }}>
          <b>≈30g protein examples:</b>
          <br />✅ 150g chicken breast
          <br />✅ 200g Greek yogurt
          <br />✅ Whey shake + milk
          <br />✅ 4 eggs + egg whites
          <br />✅ 150g lean beef
          <br />✅ Tuna + rice cakes
          <br />
          <br />
          <small style={{ color: "#666" }}>
            Goal = ~4 protein feeds/day → hits {NUTRITION_TARGETS.protein_g}g automatically.
          </small>
        </div>
      </div>

      <Labeled label="Date">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
      </Labeled>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button style={btnStyle(protein === "Yes")} onClick={() => toggle("protein", protein, setProtein)}>
          Protein {protein === "Yes" ? "✅" : "❌"}
        </button>
        <button style={btnStyle(water === "Yes")} onClick={() => toggle("water", water, setWater)}>
          Water {water === "Yes" ? "✅" : "❌"}
        </button>
        <button style={btnStyle(veg === "Yes")} onClick={() => toggle("veg", veg, setVeg)}>
          Veg {veg === "Yes" ? "✅" : "❌"}
        </button>
        <button style={btnStyle(steps === "Yes")} onClick={() => toggle("steps", steps, setSteps)}>
          Steps {steps === "Yes" ? "✅" : "❌"}
        </button>
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <Labeled label="Steps (optional number)">
          <input value={stepsCount} onChange={(e) => setStepsCount(e.target.value)} placeholder="e.g. 10350" style={styles.input} />
        </Labeled>
        <Labeled label="Energy (1–5)">
          <input value={energy} onChange={(e) => setEnergy(e.target.value)} inputMode="numeric" placeholder="1–5" style={styles.input} />
        </Labeled>
        <Labeled label="Notes">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hunger/sleep/stress etc" style={styles.input} />
        </Labeled>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button style={styles.primaryBtn} onClick={onSync}>
          Sync Nutrition to Coach 🍎
        </button>
      </div>

      {status ? <div style={{ marginTop: 8, color: "#666" }}>{status}</div> : null}

      <div style={{ marginTop: 10, color: "#2e7d32", fontWeight: 800 }}>✓ Auto saved</div>
    </div>
  );
}

// ==========================
// BODY TAB
// ==========================

function BodyTab() {
  const [date, setDate] = useState(() => localStorage.getItem("body_date") || todayDateStr());
  const key = (k) => `body_${date}_${k}`;

  const [weight, setWeight] = useState(() => localStorage.getItem(key("weight")) || "");
  const [waist, setWaist] = useState(() => localStorage.getItem(key("waist")) || "");
  const [hips, setHips] = useState(() => localStorage.getItem(key("hips")) || "");
  const [notes, setNotes] = useState(() => localStorage.getItem(key("notes")) || "");
  const [status, setStatus] = useState("");

  useEffect(() => {
    localStorage.setItem("body_date", date);
    const k = (x) => `body_${date}_${x}`;
    setWeight(localStorage.getItem(k("weight")) || "");
    setWaist(localStorage.getItem(k("waist")) || "");
    setHips(localStorage.getItem(k("hips")) || "");
    setNotes(localStorage.getItem(k("notes")) || "");
  }, [date]);

  useEffect(() => localStorage.setItem(key("weight"), weight), [date, weight]);
  useEffect(() => localStorage.setItem(key("waist"), waist), [date, waist]);
  useEffect(() => localStorage.setItem(key("hips"), hips), [date, hips]);
  useEffect(() => localStorage.setItem(key("notes"), notes), [date, notes]);

  const onSync = async () => {
    const ts = new Date().toISOString();

    const w = String(weight || "").trim();
    const wa = String(waist || "").trim();
    const h = String(hips || "").trim();
    const n = String(notes || "").trim();

    if (!w && !wa && !h && !n) return;

    const rowId = `${ATHLETE}|BODY|${date}`;
    const bodyRows = [[rowId, date, ATHLETE, w, wa, h, n, ts]];
    bodyRows.forEach((r) => upsertRowIntoHistory(BODY_LOG_KEY, r));

    setStatus("Syncing…");
    try {
      await postPayload({ setRows: [], runRows: [], nutritionRows: [], bodyRows });
      setStatus("✅ Body stats synced!");
    } catch (e) {
      console.error(e);
      setStatus("❌ Sync failed.");
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={{ margin: 0 }}>Body Tracking</h2>

      <div style={styles.planBox}>
        <b>Coach Goal</b>
        <br />
        Lean muscle gain + improved 5K endurance.
        <br />
        Track weekly trends — not daily fluctuations.
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <Labeled label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} />
        </Labeled>
        <Labeled label="Bodyweight (kg)">
          <input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="56.0" style={styles.input} />
        </Labeled>
        <Labeled label="Waist (cm)">
          <input value={waist} onChange={(e) => setWaist(e.target.value)} placeholder="Optional" style={styles.input} />
        </Labeled>
        <Labeled label="Hips (cm)">
          <input value={hips} onChange={(e) => setHips(e.target.value)} placeholder="Optional" style={styles.input} />
        </Labeled>
        <Labeled label="Notes">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sleep, cycle, stress etc" style={styles.input} />
        </Labeled>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <button style={styles.primaryBtn} onClick={onSync}>
          Sync Body to Coach 📊
        </button>
      </div>

      {status ? <div style={{ marginTop: 8, color: "#666" }}>{status}</div> : null}

      <div style={{ marginTop: 10, color: "#2e7d32", fontWeight: 800 }}>✓ Auto saved</div>
    </div>
  );
}

// ==========================
// PROGRESS TAB (charts)
// ==========================

function ProgressTab() {
  const runCanvasRef = useRef(null);
  const strengthCanvasRef = useRef(null);
  const [exercise, setExercise] = useState("");

  const runChartRef = useRef(null);
  const strengthChartRef = useRef(null);

  const exerciseOptions = useMemo(() => {
    const names = [];
    program.forEach((d) =>
      d.exercises.forEach((ex) => {
        const nm = String(ex.name || "");
        if (nm.toUpperCase().startsWith("RUN_")) return;
        if (!names.includes(nm) && ex.sets > 1) names.push(nm);
      })
    );
    return names;
  }, []);

  useEffect(() => {
    if (!exercise && exerciseOptions.length) setExercise(exerciseOptions[0]);
  }, [exercise, exerciseOptions]);

  useEffect(() => {
    let cancelled = false;

    const draw = async () => {
      try {
        await loadChartJs();
      } catch (e) {
        console.error(e);
        return;
      }
      if (cancelled) return;

      // ===== RUN PACE TREND =====
      const runRows = getLogArr(RUNS_LOG_KEY);
      const runLabels = runRows.map((r) => String(r?.[1] || "").slice(0, 10));
      const runPaceMin = runRows.map((r) => {
        const dist = parseFloat(r?.[3]);
        const mins = timeToMinutes(r?.[4]);
        if (!dist || mins == null) return null;
        return mins / dist;
      });

      const runCtx = runCanvasRef.current?.getContext?.("2d");
      if (runCtx) {
        if (runChartRef.current) runChartRef.current.destroy();
        // eslint-disable-next-line no-undef
        runChartRef.current = new Chart(runCtx, {
          type: "line",
          data: {
            labels: runLabels,
            datasets: [{ label: "Pace (min/km)", data: runPaceMin, spanGaps: true, tension: 0.25 }],
          },
          options: { responsive: true, plugins: { legend: { display: true } } },
        });
      }

      // ===== STRENGTH AVG WEIGHT =====
      const setRows = getLogArr(SETS_LOG_KEY);
      const map = new Map(); // date -> {sum,count}
      setRows.forEach((r) => {
        if (String(r?.[4]) !== exercise) return;
        const date = String(r?.[1] || "").slice(0, 10);
        const w = parseFloat(r?.[7]);
        if (!date || !Number.isFinite(w)) return;

        if (!map.has(date)) map.set(date, { sum: 0, count: 0 });
        const o = map.get(date);
        o.sum += w;
        o.count += 1;
      });

      const dates = [...map.keys()].sort();
      const avg = dates.map((d) => {
        const o = map.get(d);
        return o?.count ? o.sum / o.count : null;
      });

      const sCtx = strengthCanvasRef.current?.getContext?.("2d");
      if (sCtx) {
        if (strengthChartRef.current) strengthChartRef.current.destroy();
        // eslint-disable-next-line no-undef
        strengthChartRef.current = new Chart(sCtx, {
          type: "line",
          data: {
            labels: dates,
            datasets: [{ label: `${exercise} avg weight (kg)`, data: avg, spanGaps: true, tension: 0.25 }],
          },
          options: { responsive: true, plugins: { legend: { display: true } } },
        });
      }
    };

    draw();

    return () => {
      cancelled = true;
      if (runChartRef.current) runChartRef.current.destroy();
      if (strengthChartRef.current) strengthChartRef.current.destroy();
    };
  }, [exercise]);

  return (
    <div style={styles.card}>
      <h2 style={{ margin: 0 }}>Progress</h2>

      <div style={styles.chartBox}>
        <h3 style={{ margin: "0 0 8px 0" }}>Run Pace Trend</h3>
        <canvas ref={runCanvasRef} height={180} />
      </div>

      <div style={styles.chartBox}>
        <h3 style={{ margin: "0 0 8px 0" }}>Strength Trend</h3>
        <Labeled label="Select exercise">
          <select value={exercise} onChange={(e) => setExercise(e.target.value)} style={styles.input}>
            {exerciseOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Labeled>
        <div style={{ marginTop: 10 }}>
          <canvas ref={strengthCanvasRef} height={180} />
        </div>
      </div>

      <div style={{ color: "#666", fontSize: 13 }}>
        Tip: charts use local history. Sync Sets/Run/Nutrition/Body at least once.
      </div>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
      {children}
    </label>
  );
}

// ==========================
// STYLES
// ==========================

const styles = {
  page: {
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji",
    padding: 18,
    maxWidth: 980,
    margin: "0 auto",
    color: "#0b1020",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    background: "#f4f6ff",
    border: "1px solid #e4e8ff",
  },
  tabs: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 14,
  },
  tabBtn: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #e6e8ef",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 800,
  },
  tabBtnActive: {
    border: "1px solid #c8d1ff",
    background: "#eef1ff",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTop: "1px solid #eef0f5",
    fontSize: 12,
  },
  card: {
    background: "#fff",
    border: "1px solid #e8ebf2",
    borderRadius: 18,
    padding: 14,
    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
  },
  subCard: {
    background: "#fbfcff",
    border: "1px solid #edf0ff",
    borderRadius: 14,
    padding: 12,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e6e8ef",
    outline: "none",
  },
  row3: {
    display: "grid",
    gridTemplateColumns: "70px 1fr 1fr",
    gap: 10,
    alignItems: "center",
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
    marginTop: 10,
  },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #1a2bff",
    background: "#1a2bff",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
  ghostBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid #dbe0ff",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
  runAlert: {
    background: "#fff7e6",
    border: "1px solid #f0c36d",
    borderRadius: 12,
    padding: 14,
    margin: "12px 0",
  },
  planBox: {
    background: "#f7f7f7",
    border: "1px solid #ddd",
    borderRadius: 12,
    padding: 12,
    mar
