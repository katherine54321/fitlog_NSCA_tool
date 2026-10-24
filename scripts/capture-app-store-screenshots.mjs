import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const outputDir = join(projectRoot, "docs", "app-store-assets", "screenshots-zh");
const previewPort = 4173;
const debugPort = 9333;
const previewUrl = `http://127.0.0.1:${previewPort}/index.html`;
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const browserProfile = await mkdtemp(join(tmpdir(), "fitmine-store-shots-"));
let previewProcess;
let browserProcess;

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function waitForUrl(url, attempts = 80) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await delay(150);
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.sequence = 0;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolveConnect, rejectConnect) => {
      this.socket.addEventListener("open", resolveConnect, { once: true });
      this.socket.addEventListener("error", rejectConnect, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolveRequest, rejectRequest } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) rejectRequest(new Error(message.error.message));
      else resolveRequest(message.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    return new Promise((resolveRequest, rejectRequest) => {
      this.pending.set(id, { resolveRequest, rejectRequest });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression, { awaitPromise = true } = {}) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  }
  return result.result?.value;
}

async function waitForApp(client) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await evaluate(client, `document.readyState === "complete" && !document.body.classList.contains("is-booting")`);
    if (ready) {
      await delay(450);
      return;
    }
    await delay(100);
  }
  throw new Error("FitMine did not finish booting");
}

async function capture(client, fileName) {
  await delay(350);
  const { data } = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(join(outputDir, fileName), Buffer.from(data, "base64"));
}

async function show(client, expression) {
  await evaluate(client, expression);
  await delay(450);
}

try {
  await mkdir(outputDir, { recursive: true });
  previewProcess = spawn(process.execPath, ["preview-server.mjs"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(previewPort) },
    stdio: "ignore",
    windowsHide: true
  });
  await waitForUrl(previewUrl);

  browserProcess = spawn(edgePath, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${browserProfile}`,
    "about:blank"
  ], { stdio: "ignore", windowsHide: true });

  await waitForUrl(`http://127.0.0.1:${debugPort}/json/version`);
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(previewUrl)}`, { method: "PUT" });
  const target = await targetResponse.json();
  const client = new CdpClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 430,
    height: 932,
    deviceScaleFactor: 3,
    mobile: true,
    screenWidth: 430,
    screenHeight: 932,
    positionX: 0,
    positionY: 0
  });
  await client.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await client.send("Page.navigate", { url: previewUrl });
  await waitForApp(client);

  const initialState = {
    "fitlog-language": "zh",
    "fitlog-profile": JSON.stringify({
      age: 30,
      sex: "female",
      experience: "intermediate",
      goal: "hypertrophy",
      days: 4,
      focusArea: "back",
      focusPurpose: "hypertrophy",
      sleep: "normal",
      stress: "normal",
      limits: ""
    }),
    "fitlog-plan-saved": "true",
    "fitlog-plan-start-date": "2026-10-05",
    "fitlog-favorite-exercises": JSON.stringify([
      "incline-dumbbell-press",
      "lat-pulldown",
      "one-arm-dumbbell-row",
      "romanian-deadlift"
    ])
  };
  await evaluate(client, `localStorage.clear(); ${Object.entries(initialState).map(([key, value]) => `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`).join(";")}; location.reload()`);
  await waitForApp(client);

  await evaluate(client, `(() => {
    const workouts = [getWorkoutDay(0, 0), getWorkoutDay(0, 1), getWorkoutDay(1, 0)];
    const completedIds = workouts.map((workout) => workout.id);
    const planLogs = workouts.flatMap((workout, workoutIndex) => workout.exercises.slice(0, workoutIndex === 0 ? 1 : 4).map((item, index) => {
      const exercise = libraryExerciseForWorkout(item, "训练");
      const sets = Math.max(1, getExerciseSetCount(item));
      const reps = Math.max(6, workoutRepTarget(item.prescription) || 8);
      const weightKg = 18 + workoutIndex * 2.5 + index * 5;
      const setEntries = Array.from({ length: sets }, (_, setIndex) => ({
        setNumber: setIndex + 1,
        weightKg,
        reps: Math.max(6, reps - (setIndex === sets - 1 ? 1 : 0))
      }));
      return {
        id: "store-plan-" + workout.id + "-" + exercise.id,
        source: "plan",
        planDayId: workout.id,
        date: workout.date,
        exerciseId: exercise.id,
        exerciseName: exercise.nameZh,
        category: exercise.category,
        sets,
        setEntries,
        plannedReps: reps,
        reps,
        weightKg,
        estimated1RM: calculateBrzyckiOneRm(weightKg, reps),
        notes: "计划动作负荷已记录",
        createdAt: workout.date + "T10:00:00.000Z",
        completedAt: workout.date + "T11:00:00.000Z"
      };
    }));
    const trendDates = ["2026-09-22", "2026-09-29", "2026-10-06", "2026-10-13", "2026-10-20"];
    const trendWeights = [32.5, 35, 37.5, 40, 42.5];
    const trendLogs = trendDates.map((date, index) => ({
      id: "store-trend-" + index,
      date,
      exerciseId: "incline-dumbbell-press",
      exerciseName: "上斜哑铃卧推",
      category: "胸部",
      weightKg: trendWeights[index],
      reps: 8,
      estimated1RM: calculateBrzyckiOneRm(trendWeights[index], 8),
      setNumber: 4,
      createdAt: date + "T10:30:00.000Z"
    }));
    const records = workouts.map((workout) => ({
      id: "store-record-" + workout.id,
      planDayId: workout.id,
      source: "plan",
      date: workout.date,
      name: workout.name,
      description: workout.description,
      sets: workout.exercises.reduce((sum, item) => sum + getExerciseSetCount(item), 0),
      actions: workout.exercises.length,
      rm: workout.plan.rm,
      exercises: workout.exercises,
      completedAt: workout.date + "T11:00:00.000Z"
    }));
    localStorage.setItem("fitlog-plan-completed", JSON.stringify(completedIds));
    localStorage.setItem("fitlog-training-set-logs", JSON.stringify([...planLogs, ...trendLogs]));
    localStorage.setItem("fitlog-records", JSON.stringify(records));
    location.reload();
  })()`);
  await waitForApp(client);

  await show(client, `location.hash = "home"`);
  await show(client, `window.scrollTo(0, 0)`);
  await capture(client, "01-home-overview.png");

  await show(client, `location.hash = "plan"`);
  await show(client, `window.scrollTo(0, 0)`);
  await capture(client, "02-periodized-plan.png");

  await show(client, `openWorkoutDetail(0, 0)`);
  await show(client, `document.querySelectorAll(".flow-heading")[1]?.scrollIntoView({ block: "start" }); window.scrollBy(0, -76)`);
  await capture(client, "03-workout-exercises.png");

  await show(client, `document.querySelector('[data-toggle-inline-workout-log="0"]')?.click(); document.querySelector('[data-inline-workout-log-panel="0"]')?.scrollIntoView({ block: "center" }); window.scrollBy(0, -40)`);
  await capture(client, "04-per-set-logging.png");

  await show(client, `openExerciseDetail("incline-dumbbell-press", "training")`);
  await show(client, `window.scrollTo(0, 0)`);
  await capture(client, "05-exercise-details.png");

  await show(client, `location.hash = "records"`);
  await show(client, `setRecordPane("actionRecordPane"); renderRecords(); renderOverloadMonitor("incline-dumbbell-press")`);
  await show(client, `document.documentElement.style.scrollBehavior = "auto"; document.querySelector("#records").style.paddingBottom = "700px"; const monitor = document.querySelector("#overloadMonitor"); window.scrollTo(0, Math.max(0, monitor.getBoundingClientRect().top + window.scrollY - 18))`);
  await capture(client, "06-strength-trends.png");

  client.close();
  console.log(`Created 6 App Store screenshots in ${outputDir}`);
} finally {
  if (browserProcess && !browserProcess.killed) browserProcess.kill();
  if (previewProcess && !previewProcess.killed) previewProcess.kill();
  await delay(500);
  await rm(browserProfile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
