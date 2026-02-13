// ==========================
// ALANA TRAINING APP
// STAGE 2 — WORKOUT ENGINE
// ==========================

const app = document.getElementById("app");

const STORAGE_DAY = "currentTrainingDay";
window.startRestTimer = startRestTimer;

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
function getSuggestion(dayIndex, exIndex, targetReps){

  let totalWeight = 0;
  let totalReps = 0;
  let setsLogged = 0;

  for(let s=1; s<=6; s++){

    const w = parseFloat(
      localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-w`)
    );

    const r = parseFloat(
      localStorage.getItem(`d${dayIndex}-e${exIndex}-s${s}-r`)
    );

    if(!isNaN(w) && !isNaN(r)){
      totalWeight += w;
      totalReps += r;
      setsLogged++;
    }
  }

  if(!setsLogged) return "";

  const avgWeight = totalWeight / setsLogged;
  const avgReps = totalReps / setsLogged;

  let increase = 0;

  if(avgReps >= targetReps) increase = 2.5;
  else if(avgReps >= targetReps - 1) increase = 1.25;
  else increase = 0;

  return (avgWeight + increase).toFixed(1);
}


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

function startRestTimer(btn){

  let seconds = 60;
  btn.disabled = true;

  const interval = setInterval(()=>{
    btn.innerText = `Rest ${seconds}s`;
    seconds--;

    if(seconds < 0){
      clearInterval(interval);
      btn.innerText = "Start 60s Rest";
      btn.disabled = false;
    }
  },1000);
}


function renderToday(){

  const dayIndex = getCurrentDay();
  const day = program[dayIndex];

  let html = `
    <div class="card">
      <h2>Today</h2>
      <h3>${day.name}</h3>
  `;

  day.exercises.forEach((ex, exIndex)=>{

    const suggestion =
  getSuggestion(dayIndex, exIndex, ex.reps);

html += `
  <h4>${ex.name} — ${ex.sets} x ${ex.reps}</h4>
  <small style="color:#666;">
    ${suggestion ? `Suggested next time: ${suggestion} kg` : ""}
  </small>
`;


    for(let s=1; s<=ex.sets; s++){

      const weightKey=`d${dayIndex}-e${exIndex}-s${s}-w`;
      const repsKey=`d${dayIndex}-e${exIndex}-s${s}-r`;

      const weight=localStorage.getItem(weightKey)||"";
      const reps=localStorage.getItem(repsKey)||"";

      html+=`
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

    html+=`
      <button onclick="startRestTimer(this)">
        Start 60s Rest
      </button>
      <hr>
    `;
  });

  html+=`
    <button onclick="nextDay()">Finish Workout ✅</button>
    <p style="color:green;">✓ Auto saved</p>
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
