import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("single-workout changes preserve day identities and shift collisions without changing the weekly template", () => {
  const start = source.indexOf("function parseLocalDate(value)");
  const end = source.indexOf("const focusAreaDefinitions =", start);
  assert.ok(start > 0 && end > start);
  const values = new Map([["fitlog-plan-start-date", "2026-10-26"], ["fitlog-plan-saved", "true"]]);
  const profile = { goal: "hypertrophy", experience: "intermediate" };
  const plan = { days: 4, split: [["A"], ["B"], ["C"], ["D"]], periodization: [{ title: "Week 1" }] };
  const context = {
    TRAINING_DAY_PREFERENCES_KEY: "fitlog-training-day-preferences",
    PLAN_ADJUSTMENTS_KEY: "fitlog-plan-adjustments",
    today: "2026-10-28",
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    getProfile: () => profile,
    buildPlan: () => plan
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.schedule = getResolvedPlanSchedule; this.key = getPlanScheduleKey; this.week = getCurrentPlanWeek;`, context);
  const original = context.schedule(profile, plan);
  assert.deepEqual(Array.from(original.slice(0, 4), (day) => day.date), ["2026-10-26", "2026-10-27", "2026-10-29", "2026-10-30"]);
  const changes = { planKey: context.key(profile, plan), overrides: { [original[0].id]: { deferDays: 1 } }, pauses: [], pausedAt: null };
  values.set("fitlog-plan-adjustments", JSON.stringify(changes));
  const deferred = context.schedule(profile, plan);
  assert.equal(deferred[0].id, original[0].id);
  assert.deepEqual(Array.from(deferred.slice(0, 4), (day) => day.date), ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]);
  changes.overrides[original[0].id] = { status: "skipped" };
  values.set("fitlog-plan-adjustments", JSON.stringify(changes));
  const skipped = context.schedule(profile, plan);
  assert.equal(skipped[0].skipped, true);
  assert.equal(skipped[1].date, original[1].date);
  changes.overrides = {};
  changes.pauses = [{ start: "2026-10-28", days: 3 }];
  values.set("fitlog-plan-adjustments", JSON.stringify(changes));
  const resumed = context.schedule(profile, plan);
  assert.equal(resumed[0].date, original[0].date);
  assert.equal(resumed[2].date, "2026-11-01");
  assert.equal(context.week("2026-10-26", profile, plan), 0);
});

test("pounds are converted for entry while stored loads remain kilograms", () => {
  const start = source.indexOf("const WEIGHT_UNIT_KEY =");
  const end = source.indexOf("const interfaceTranslations =", start);
  assert.ok(start > 0 && end > start);
  const context = { localStorage: { getItem: () => "lb" } };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.displayWeight = displayWeight; this.storageWeight = storageWeight; this.weightText = weightText;`, context);
  assert.equal(context.displayWeight(20), 44.1);
  assert.ok(Math.abs(context.storageWeight(44.1) - 20) < 0.02);
  assert.equal(context.weightText(20), "44.1 lb");
});

test("weekly muscle volume counts logged completed sets and ignores plan placeholders", () => {
  const start = source.indexOf("function renderMuscleVolume()");
  const end = source.indexOf("function renderRecords()", start);
  assert.ok(start > 0 && end > start);
  const grid = { innerHTML: "" };
  const note = { textContent: "" };
  const context = {
    document: { querySelector: (selector) => selector === "#muscleVolumeGrid" ? grid : note },
    appLanguage: "en",
    today: "2026-10-28",
    trainingSetLogs: [
      { date: "2026-10-28", exerciseId: "press", setEntries: [
        { completed: true, reps: 8, weightKg: 20 },
        { completed: true, reps: 8, weightKg: 20 },
        { completed: false, reps: 8, weightKg: 20 }
      ] },
      { date: "2026-10-28", exerciseId: "press", sets: 4, weightKg: null, reps: 8 },
      { date: "2026-10-27", exerciseId: "press", sets: 2, weightKg: 25, reps: 8 }
    ],
    getLoggableExercises: () => [{ id: "press", primaryMuscles: ["胸部"] }],
    escapeLogText: (value) => value,
    translateInterfaceText: (value) => value,
    parseLocalDate: (value) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); },
    formatLocalDate: (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    addDays: (value, amount) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + amount); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.renderMuscleVolume = renderMuscleVolume;`, context);
  context.renderMuscleVolume();
  assert.match(grid.innerHTML, /胸部<\/span><strong>4 sets/);
  assert.doesNotMatch(grid.innerHTML, /6 sets/);
});
