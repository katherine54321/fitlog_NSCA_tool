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

test("a Monday Wednesday Friday plan that ended October 23 is expired on October 28", () => {
  const start = source.indexOf("function parseLocalDate(value)");
  const end = source.indexOf("const focusAreaDefinitions =", start);
  const values = new Map([["fitlog-plan-start-date", "2026-09-26"]]);
  const profile = { goal: "hypertrophy", experience: "intermediate" };
  const plan = { days: 3, split: [["A"], ["B"], ["C"]] };
  const context = {
    TRAINING_DAY_PREFERENCES_KEY: "fitlog-training-day-preferences",
    PLAN_ADJUSTMENTS_KEY: "fitlog-plan-adjustments",
    today: "2026-10-28",
    localStorage: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
    getProfile: () => profile,
    buildPlan: () => plan
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.schedule = getResolvedPlanSchedule; this.key = getPlanScheduleKey; this.week = getCurrentPlanWeek; this.endDate = getPlanCycleEndDate; this.expired = isPlanCycleExpired;`, context);
  values.set("fitlog-training-day-preferences", JSON.stringify({ planKey: context.key(profile, plan), recurring: [1, 3, 5] }));
  const schedule = context.schedule(profile, plan);
  assert.deepEqual(Array.from(schedule.slice(-3), (item) => item.date), ["2026-10-19", "2026-10-21", "2026-10-23"]);
  assert.equal(context.week("2026-09-26", profile, plan), 3);
  assert.equal(context.endDate(profile, plan), "2026-10-23");
  assert.equal(context.expired(profile, plan), true);
  const adjustments = { planKey: context.key(profile, plan), overrides: { [schedule.at(-1).id]: { deferDays: 6 } }, pauses: [], pausedAt: null };
  values.set("fitlog-plan-adjustments", JSON.stringify(adjustments));
  assert.equal(context.endDate(profile, plan), "2026-10-29");
  assert.equal(context.expired(profile, plan), false);
});

test("defer and skip accept only today's unfinished workout, and a skipped workout can be restored today", () => {
  const start = source.indexOf("function changePlanSchedule(action, workout = activeWorkoutDay)");
  const end = source.indexOf("function formatPlanDateLabel(value)", start);
  assert.ok(start > 0 && end > start);
  const todayWorkout = { id: "today", date: "2026-10-28", weekIndex: 0, dayIndex: 0 };
  const futureWorkout = { id: "future", date: "2026-10-29", weekIndex: 0, dayIndex: 1 };
  const changes = { overrides: {}, pausedAt: null };
  let writes = 0;
  const context = {
    today: "2026-10-28",
    activeWorkoutDay: null,
    completedPlanDays: [],
    initializedModules: new Set(),
    getProfile: () => ({}), buildPlan: () => ({}), loadPlanAdjustments: () => changes,
    getWorkoutDay: (_, dayIndex) => dayIndex === 0 ? todayWorkout : futureWorkout,
    addDays: (value, days) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); },
    parseLocalDate: (value) => new Date(`${value}T12:00:00`),
    localStorage: { setItem: () => { writes++; } },
    PLAN_ADJUSTMENTS_KEY: "fitlog-plan-adjustments",
    window: { FitLogSync: { queueSync() {} } }, renderPlan() {}, renderRecords() {}, renderWorkoutDetail() {}
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.change = changePlanSchedule;`, context);
  context.change("defer", futureWorkout);
  context.change("skip", futureWorkout);
  assert.equal(writes, 0);
  context.change("skip", todayWorkout);
  assert.equal(changes.overrides.today.status, "skipped");
  assert.equal(writes, 1);
  context.change("restore", todayWorkout);
  assert.equal(changes.overrides.today, undefined);
  context.completedPlanDays.push(todayWorkout.id);
  context.change("defer", todayWorkout);
  assert.equal(writes, 2);
});

test("home offers low-emphasis schedule actions only for today's unfinished workout", () => {
  const start = source.indexOf("function renderHomeTodayPlan(profile, plan, saved)");
  const end = source.indexOf("function renderHomeTrainingCalendar(profile, plan, saved)", start);
  assert.ok(start > 0 && end > start);
  const card = { innerHTML: "" };
  const dateLabel = { textContent: "" };
  const workout = { id: "today", date: "2026-10-28", weekIndex: 0, dayIndex: 0, day: "Upper", text: "Push and pull", period: { sets: 4, reps: "8-12", rest: "60s" } };
  const context = {
    document: { querySelector: (selector) => selector === "#homeTodayPlan" ? card : dateLabel },
    today: "2026-10-28", appLanguage: "en", completedPlanDays: [], planHistory: [],
    planNames: { hypertrophy: "Hypertrophy" },
    getScheduledPlanDays: () => [workout], getResolvedPlanSchedule: () => [workout],
    isPlanCycleExpired: () => false,
    getPlanCycleEndDate: () => "2026-10-23",
    formatPlanDateLabel: (date) => date, translateInterfaceText: (value) => value,
    historyPlanDisplayTitle: (item) => item.title,
    escapeLogText: (value) => value
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.render = renderHomeTodayPlan;`, context);
  context.render({}, { reps: "8-12", rest: "60s" }, true);
  assert.match(card.innerHTML, /Start workout/);
  assert.match(card.innerHTML, /data-home-schedule="defer"/);
  assert.match(card.innerHTML, /class="home-today-secondary"/);
  context.completedPlanDays.push(workout.id);
  context.render({}, { reps: "8-12", rest: "60s" }, true);
  assert.doesNotMatch(card.innerHTML, /data-home-schedule="defer"/);
  context.completedPlanDays.length = 0;
  workout.date = "2026-10-29";
  context.render({}, { reps: "8-12", rest: "60s" }, true);
  assert.doesNotMatch(card.innerHTML, /data-home-schedule="skip"/);
  context.isPlanCycleExpired = () => true;
  context.render({ goal: "hypertrophy" }, { days: 3, reps: "8-12", rest: "60s" }, true);
  assert.match(card.innerHTML, /No current plan/);
  assert.match(card.innerHTML, /Previous plan: Hypertrophy · 3 days\/week · Ended 2026-10-23/);
  assert.match(card.innerHTML, /class="home-today-action" href="#plan">Create a plan/);
  assert.doesNotMatch(card.innerHTML, /Rest day/);
  assert.doesNotMatch(card.innerHTML, /Go to Plan/);
  context.planHistory.push({ title: "Earlier plan", savedAt: "2026-09-25" });
  context.render({}, {}, false);
  assert.match(card.innerHTML, /Previous plan: Earlier plan · Ended 2026-09-25/);
});

test("home presents an expired plan as the previous plan with its end date", () => {
  const start = source.indexOf("function renderHome() {");
  const end = source.indexOf("function renderRisk(", start);
  const fields = new Map();
  const field = (selector) => {
    if (!fields.has(selector)) fields.set(selector, { textContent: "", hidden: false });
    return fields.get(selector);
  };
  const plan = { days: 3, split: [["A"], ["B"], ["C"]], periodization: [{ title: "1" }, { title: "2" }, { title: "3" }, { title: "4" }] };
  const context = {
    document: { querySelector: field },
    appLanguage: "zh", planNames: { hypertrophy: "增肌" },
    getProfile: () => ({ goal: "hypertrophy" }), buildPlan: () => plan,
    hasGeneratedPlan: () => true, renderHomeTodayPlan() {}, renderHomeTrainingCalendar() {},
    getPlanStartDate: () => "2026-09-26", getCurrentPlanWeek: () => 3,
    isPlanCycleExpired: () => true, getPlanCycleEndDate: () => "2026-10-23",
    formatPlanDateLabel: (date) => date, allPlanDayIds: () => ["one", "two"],
    completedPlanDays: ["one"], translateInterfaceText: (text) => text,
    planConsole: field("planConsole"), planStartDateInput: field("planStartDateInput"),
    currentWeekLabel: field("currentWeekLabel"), planPattern: field("planPattern"),
    planPatternText: () => "A / B / C",
    planProgressPie: { style: { setProperty() {} } },
    planProgressPercent: field("planProgressPercent"), planProgressText: field("planProgressText"),
    planProgressHint: field("planProgressHint")
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.render = renderHome;`, context);
  context.render();
  assert.equal(field("#homeTitle").textContent, "当前无计划");
  assert.match(field("#homeSummary").textContent, /上一个计划：增肌 · 每周 3 天 · 结束日期 2026-10-23/);
  assert.equal(field("planConsole").hidden, true);
  assert.equal(field("#home .hero-copy").hidden, true);
  assert.equal(field("currentWeekLabel").textContent, "");
});

test("an ended saved plan shows the empty current pane and appears in history", () => {
  const modeStart = source.indexOf("function updatePlanMode(profile, plan)");
  const modeEnd = source.indexOf("function getViewablePlanHistory()", modeStart);
  const historyEnd = source.indexOf("function historyPlanDisplayTitle(", modeEnd);
  assert.ok(modeStart > 0 && historyEnd > modeEnd);
  const empty = { hidden: true };
  const current = { hidden: false };
  const edit = { hidden: false };
  const oldEntry = { id: "older" };
  const context = {
    planEmptyState: empty,
    planTemplateLibrary: { hidden: true },
    pendingOfficialTemplateId: null,
    profileEditor: { hidden: false }, savePlanButton: { hidden: false }, editPlanButton: edit,
    document: { querySelectorAll: () => [current] },
    isEditingPlan: false, hasGeneratedPlan: () => true, isPlanCycleExpired: () => true,
    planHistory: [oldEntry],
    localStorage: { getItem: (key) => key === "fitlog-profile" ? JSON.stringify({ goal: "hypertrophy", days: 3 }) : null },
    getProfile: () => ({ goal: "hypertrophy", days: 3 }),
    buildPlan: () => ({ days: 3 }), getPlanStartDate: () => "2026-09-26",
    allPlanDayIds: () => ["one", "two"], completedPlanDays: ["one"],
    getPlanScheduleKey: () => "old-plan", getPlanCycleEndDate: () => "2026-10-23",
    getResolvedPlanSchedule: () => [{ date: "2026-10-23" }], planNames: { hypertrophy: "增肌" }
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(modeStart, historyEnd)}\nthis.updateMode = updatePlanMode; this.historyEntries = getViewablePlanHistory;`, context);
  context.updateMode({}, {});
  assert.equal(empty.hidden, false);
  assert.equal(context.planTemplateLibrary.hidden, false);
  assert.equal(current.hidden, true);
  assert.equal(edit.hidden, true);
  const entries = context.historyEntries();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].endedAt, "2026-10-23");
  assert.equal(entries[0].completed, 1);
  assert.equal(entries[1], oldEntry);
  context.isPlanCycleExpired = () => false;
  context.updateMode({}, {});
  assert.equal(empty.hidden, true);
  assert.equal(context.planTemplateLibrary.hidden, true);
  assert.equal(current.hidden, false);
  assert.equal(edit.hidden, false);
  assert.equal(context.historyEntries().length, 1);
  context.hasGeneratedPlan = () => false;
  context.planHistory = [];
  context.updateMode({}, {});
  assert.equal(empty.hidden, false);
  assert.equal(context.planTemplateLibrary.hidden, false);
});

test("the plan page heading stops presenting an expired plan as current", () => {
  const start = source.indexOf("function renderPlan() {");
  const end = source.indexOf("function hasGeneratedPlan()", start);
  assert.ok(start > 0 && end > start);
  const fields = new Map();
  const field = (key) => {
    if (!fields.has(key)) fields.set(key, { textContent: "", innerHTML: "", disabled: false, style: { setProperty() {} } });
    return fields.get(key);
  };
  const plan = {
    days: 3, load: "67-85%", rm: "6-12 RM", reps: "8-12", rest: "60s", setRange: "3-4",
    risk: { level: "unassessed" }, split: [["Leg day", "Squat focus"]],
    periodization: [{ label: "第 1 周", title: "动作适应周", focus: "练习动作", sets: 3, reps: "8-12", rm: "6-12 RM", load: "70%", rest: "60s" }]
  };
  let expired = true;
  const context = {
    document: { querySelector: field }, appLanguage: "zh", isEditingPlan: false, pendingOfficialTemplateId: null, activePlanWeekIndex: 0,
    getProfile: () => ({ goal: "hypertrophy" }), buildPlan: () => plan, planNames: { hypertrophy: "增肌" },
    hasGeneratedPlan: () => true, isPlanCycleExpired: () => expired,
    translateInterfaceText: (value) => value, formatPeriodIntensity: (value) => value,
    getPlanStartDate: () => "2026-09-26", loadPlanAdjustments: () => ({ pausedAt: null }),
    getResolvedPlanSchedule: () => [{ weekIndex: 0, dayIndex: 0, date: "2026-09-28", skipped: false, paused: false }],
    formatPlanDateLabel: (value) => value, displayLoadAdvice: (value) => value,
    periodizationWeeks: field("periodizationWeeks"), activeWeekKicker: field("activeWeekKicker"),
    activeWeekTitle: field("activeWeekTitle"), activeWeekFocus: field("activeWeekFocus"),
    activeWeekPrescription: field("activeWeekPrescription"), weekPlan: field("weekPlan"),
    loadRules: field("loadRules"), updatePlanMode() {}, renderPlanTemplateLibrary() {}, renderHome() {}
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.render = renderPlan;`, context);
  context.render();
  assert.equal(field("#planTitle").textContent, "训练计划");
  assert.equal(field("#planSummary").textContent, "");
  assert.equal(field("#planPauseToggle").disabled, true);
  expired = false;
  context.render();
  assert.equal(field("#planTitle").textContent, "增肌 · 每周 3 天");
  assert.match(field("#planSummary").textContent, /4 周周期训练计划/);
});

test("archiving a plan preserves its end date without copying exercise data", () => {
  const start = source.indexOf("function archiveCurrentPlan()", source.indexOf("function getViewablePlanHistory()"));
  const end = source.indexOf("function renderPlanHistory()", start);
  assert.ok(start > 0 && end > start);
  const stored = new Map([["fitlog-profile", JSON.stringify({ goal: "hypertrophy", days: 3 })]]);
  const plan = { days: 3, split: [["Leg day", "Squat focus"]] };
  const context = {
    today: "2026-10-28", planNames: { hypertrophy: "增肌" }, planHistory: [], completedPlanDays: ["one"],
    localStorage: { getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    buildPlan: () => plan, getPlanStartDate: () => "2026-09-26", allPlanDayIds: () => ["one", "two"],
    isPlanCycleExpired: () => true, getPlanCycleEndDate: () => "2026-10-23",
    getResolvedPlanSchedule: () => [{ id: "one", weekIndex: 0, dayIndex: 0, date: "2026-09-28" }]
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.archive = archiveCurrentPlan;`, context);
  context.archive();
  const archived = JSON.parse(stored.get("fitlog-plan-history"))[0];
  assert.equal(archived.endedAt, "2026-10-23");
  assert.equal(archived.planSnapshot, undefined);
  assert.equal(archived.exerciseSnapshot, undefined);
  assert.equal(archived.completed, 1);
});

test("history cards open read-only plan details and older entries still open", () => {
  const start = source.indexOf("function renderPlanHistory() {");
  const end = source.indexOf("function renderResistanceTemplates()", start);
  assert.ok(start > 0 && end > start);
  const plan = { days: 3, marker: "current", split: [["Leg day", "Squat focus"]], periodization: [{ title: "Foundation", sets: 4, reps: "8 reps", load: "70%" }] };
  const oldPlan = { ...plan, marker: "old" };
  const schedule = [
    { id: "one", weekIndex: 0, dayIndex: 0, date: "2026-09-28" },
    { id: "two", weekIndex: 0, dayIndex: 1, date: "2026-09-30" },
    { id: "three", weekIndex: 0, dayIndex: 2, date: "2026-10-02", skipped: true }
  ];
  const entries = [
    { title: "Plan A", startDate: "2026-09-26", endedAt: "2026-10-23", completed: 1, total: 12,
      profile: { days: 3 }, planSnapshot: plan, scheduleSnapshot: schedule },
    { title: "Old plan", startDate: "2026-08-01", savedAt: "2026-08-28", completed: 2, total: 12, profile: { days: 3 } }
  ];
  const list = { innerHTML: "", hidden: false };
  const detail = { innerHTML: "", hidden: true };
  const context = {
    appLanguage: "en", planHistoryList: list, planHistoryDetail: detail, records: [], completedPlanDays: ["one"],
    getViewablePlanHistory: () => entries, historyPlanDisplayTitle: (item) => item.title,
    escapeLogText: (value) => String(value), translateInterfaceText: (value) => value,
    buildPlan: () => oldPlan, getProfile: () => ({}), getResolvedPlanSchedule: () => schedule,
    getWorkoutExercises: (_, selectedPlan) => [{ name: selectedPlan.marker === "current" ? "Barbell squat" : "Fallback curl", prescription: "3 × 10" }],
    applyPlanExerciseReplacements: (_, exercises) => exercises,
    ensureUniqueWorkoutExercises: (exercises) => exercises
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.renderList = renderPlanHistory; this.renderDetail = renderHistoryPlanDetail;`, context);
  context.renderList();
  assert.match(list.innerHTML, /data-history-plan-index="0"/);
  assert.match(list.innerHTML, /data-history-plan-index="1"/);
  context.renderDetail(0);
  assert.equal(list.hidden, false);
  assert.match(detail.innerHTML, /Barbell squat/);
  assert.match(detail.innerHTML, /2026-09-28/);
  assert.match(detail.innerHTML, /Completed/);
  assert.match(detail.innerHTML, /Not completed/);
  assert.match(detail.innerHTML, /Skipped/);
  assert.doesNotMatch(detail.innerHTML, /Fallback curl/);
  context.renderDetail(1);
  assert.match(detail.innerHTML, /Fallback curl/);
  assert.doesNotMatch(detail.innerHTML, /reconstructed from saved settings/);
  context.records.push({ planDayId: "one", exercises: [{ name: "Recorded squat", prescription: "4 × 8" }] });
  context.renderDetail(1);
  assert.match(detail.innerHTML, /Training day 1[\s\S]*?<ul><li>Recorded squat/);
  assert.doesNotMatch(detail.innerHTML.match(/<div class="history-workout">[\s\S]*?<\/div>/)[0], /Fallback curl/);
});

test("empty plan hides current metrics and opens history in a separate route", () => {
  assert.match(source, /#plan \[data-plan-current-content\]\[hidden\][\s\S]*?display: none/);
  assert.match(source, /<section class="panel section module-panel" id="plan-history-detail" data-module-panel hidden>/);
  assert.match(source, /activeHistoryPlanIndex = Number\(button\.dataset\.historyPlanIndex\);[\s\S]*?window\.location\.hash = "plan-history-detail"/);
  assert.doesNotMatch(source, /<span class="chip">当前计划<\/span>\s*<h3>当前无计划/);
});

test("home training actions use an outline instead of a solid fill", () => {
  assert.match(source, /\.home-today-action\s*\{[^}]*border: 1px solid var\(--brand\);[^}]*color: var\(--brand\);\s*background: transparent;/);
});

test("official templates select the requested training days while medical limits still apply", () => {
  const start = source.indexOf("function getSelectedResistanceTemplate() {");
  const end = source.indexOf("function makeHypertrophySplit", start);
  const stored = new Map([["fitlog-plan-template", "hypertrophy-4"]]);
  let riskLevel = "low";
  const context = {
    localStorage: { getItem: (key) => stored.get(key) ?? null },
    resistanceTemplates: [{ id: "hypertrophy-3", days: 3 }, { id: "hypertrophy-4", days: 4 }],
    getPlanRisk: () => ({ level: riskLevel }),
    getGoalPrescription: () => ({ load: "70%", rm: "8RM", reps: "8", setRange: "3-4", baseSetCount: 3, rest: "60s" }),
    makeSplit: (days) => Array.from({ length: days }, (_, i) => [`Day ${i + 1}`, ""]),
    createPeriodization: () => [{ title: "Week 1" }],
    focusAreaLabels: {}, focusPurposeLabels: {}
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.build = buildPlan;`, context);
  const profile = { goal: "hypertrophy", experience: "intermediate", days: 3 };
  assert.equal(context.build(profile).days, 4);
  assert.equal(context.build(profile).split.length, 4);
  assert.equal(context.build(profile, null).days, 3);
  riskLevel = "high";
  assert.equal(context.build(profile).days, 2);
});

test("using a historical plan starts a new cycle with its saved plan settings", () => {
  const start = source.indexOf("function saveCurrentPlan({ templateId = null");
  const end = source.indexOf("function renderEvaluationOverview()", start);
  const stored = new Map([
    ["fitlog-plan-start-date", "2026-09-26"],
    ["fitlog-plan-template", "hypertrophy-4"]
  ]);
  const fields = new Map(Object.entries({ goal: "strength", experience: "beginner", trainingDays: "2", focusArea: "", focusPurpose: "" })
    .map(([key, value]) => [`#${key}`, { value }]));
  const entry = { profile: { goal: "hypertrophy", experience: "intermediate", days: 3, focusArea: "glutes", focusPurpose: "hypertrophy" }, templateId: "hypertrophy-3" };
  let archived = 0;
  const context = {
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
      removeItem: (key) => stored.delete(key)
    },
    document: { querySelector: (key) => fields.get(key) },
    getViewablePlanHistory: () => [entry], assessRisk: () => ({ level: "low" }),
    hasGeneratedPlan: () => true, archiveCurrentPlan: () => { archived++; },
    getProfile: () => ({ goal: fields.get("#goal").value, experience: fields.get("#experience").value,
      days: Number(fields.get("#trainingDays").value), focusArea: fields.get("#focusArea").value,
      focusPurpose: fields.get("#focusPurpose").value }),
    getRiskAnswers: () => ({}), renderPlanHistory() {}, renderResistanceTemplates() {},
    renderPlan() {}, setPlanPane() {}, today: "2026-10-28", activePlanWeekIndex: 2,
    TRAINING_DAY_PREFERENCES_KEY: "preferences", PLAN_ADJUSTMENTS_KEY: "adjustments",
    resistanceTemplates: []
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.useHistory = applyHistoryPlanTemplate;`, context);
  context.useHistory(0);
  assert.equal(archived, 1);
  assert.equal(stored.get("fitlog-plan-start-date"), "2026-10-28");
  assert.equal(stored.get("fitlog-plan-template"), "hypertrophy-3");
  assert.deepEqual(JSON.parse(stored.get("fitlog-profile")), entry.profile);
  assert.equal(context.activePlanWeekIndex, 0);
});

test("saving an unchanged edited plan keeps its cycle and only changed options create a new one", () => {
  const start = source.indexOf("function planSelectionsMatchSaved() {");
  const end = source.indexOf("function clearPendingOfficialTemplate()", start);
  const saved = { goal: "hypertrophy", experience: "intermediate", days: 3, focusArea: "", focusPurpose: "" };
  const current = { ...saved };
  const values = new Map([
    ["fitlog-profile", JSON.stringify(saved)], ["fitlog-plan-saved", "true"],
    ["fitlog-plan-start-date", "2026-09-26"], ["fitlog-plan-template", "hypertrophy-3"]
  ]);
  let archives = 0;
  let expired = false;
  const context = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    },
    getProfile: () => current, getRiskAnswers: () => ({}), hasGeneratedPlan: () => true,
    buildPlan: () => ({}), isPlanCycleExpired: () => expired,
    archiveCurrentPlan: () => { archives++; }, renderPlanHistory() {}, renderResistanceTemplates() {},
    isEditingPlan: true, today: "2026-10-28",
    TRAINING_DAY_PREFERENCES_KEY: "preferences", PLAN_ADJUSTMENTS_KEY: "adjustments"
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.save = saveCurrentPlan;`, context);
  assert.equal(context.save({ preventSamePlan: true }), false);
  assert.equal(archives, 0);
  assert.equal(values.get("fitlog-plan-start-date"), "2026-09-26");
  assert.equal(values.get("fitlog-plan-template"), "hypertrophy-3");
  assert.equal(context.isEditingPlan, true);
  current.days = 4;
  assert.equal(context.save({ preventSamePlan: true }), true);
  assert.equal(archives, 1);
  assert.equal(values.get("fitlog-plan-start-date"), "2026-10-28");
  assert.equal(JSON.parse(values.get("fitlog-profile")).days, 4);
  expired = true;
  context.isEditingPlan = true;
  assert.equal(context.save({ preventSamePlan: true }), true);
  assert.equal(archives, 2);
});

test("history templates keep only the latest plan for each distinct set of plan settings", () => {
  const start = source.indexOf("function getUniqueHistoryPlanTemplates() {");
  const end = source.indexOf("function renderPlanTemplateLibrary()", start);
  const base = { goal: "hypertrophy", experience: "intermediate", days: 3, focusArea: "glutes", focusPurpose: "hypertrophy" };
  const entries = [
    { id: "recent", profile: base },
    { id: "older", profile: { ...base } },
    { id: "other-focus", profile: { ...base, focusArea: "chest" } },
    { id: "same-official-template", profile: base, templateId: "hypertrophy-3" },
    { id: "different-split", profile: base, templateId: "special-3" }
  ];
  const context = { getViewablePlanHistory: () => entries, appLanguage: "zh",
    resistanceTemplates: [{ id: "hypertrophy-3" }, { id: "special-3", split: [["A"], ["B"], ["C"]] }] };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.unique = getUniqueHistoryPlanTemplates; this.mismatch = officialTemplateMismatch;`, context);
  assert.deepEqual(Array.from(context.unique(), ({ item }) => item.id), ["recent", "other-focus", "different-split"]);
  const template = { days: 4, minExperience: "intermediate" };
  assert.match(context.mismatch(template, { experience: "beginner", days: 4 }), /中级/);
  assert.match(context.mismatch(template, { experience: "intermediate", days: 3 }), /至少 4/);
  assert.equal(context.mismatch(template, { experience: "intermediate", days: 4 }), "");
});

test("no-plan template library shows only official plans when history is empty", () => {
  const start = source.indexOf("function renderPlanTemplateLibrary() {");
  const end = source.indexOf("function renderResistanceTemplates()", start);
  const title = { hidden: false };
  const historySection = { hidden: false };
  const historyList = { innerHTML: "" };
  const officialList = { innerHTML: "" };
  const library = { labelledBy: "", setAttribute(name, value) { this.labelledBy = value; } };
  const context = {
    appLanguage: "zh", historyTemplateList: historyList, officialTemplateList: officialList,
    planTemplateLibrary: library,
    document: { querySelector: (selector) => selector === "#planTemplateTitle" ? title : historySection },
    getUniqueHistoryPlanTemplates: () => [], assessRisk: () => ({ level: "low" }),
    resistanceTemplates: [{ id: "hypertrophy-3", goal: "hypertrophy", name: "增肌", days: 3, conditions: "初学者及以上" }],
    escapeLogText: (value) => value
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.render = renderPlanTemplateLibrary;`, context);
  context.render();
  assert.equal(title.hidden, true);
  assert.equal(historySection.hidden, true);
  assert.equal(historyList.innerHTML, "");
  assert.equal(library.labelledBy, "officialTemplateHeading");
  assert.match(officialList.innerHTML, /增肌 · 每周 3 天/);
  assert.match(officialList.innerHTML, /查看计划详情/);
  assert.doesNotMatch(officialList.innerHTML, /使用该计划/);
});

test("empty history tab remains available and shows a clear empty state", () => {
  const start = source.indexOf("function renderPlanHistory() {");
  const end = source.indexOf("function renderHistoryPlanDetail(", start);
  const context = {
    appLanguage: "zh", planHistoryList: { innerHTML: "" },
    getViewablePlanHistory: () => []
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.render = renderPlanHistory;`, context);
  context.render();
  assert.match(source, /data-plan-tab="historyPlanPane">历史训练计划/);
  assert.match(context.planHistoryList.innerHTML, /当前无历史计划记录/);
});

test("official template detail previews schedule before offering plan use", () => {
  const start = source.indexOf("function renderOfficialTemplateDetail() {");
  const end = source.indexOf("function renderPlanTemplateLibrary()", start);
  const detail = { innerHTML: "" };
  const context = {
    appLanguage: "zh", activeOfficialTemplateId: "hypertrophy-3", activeOfficialTemplateWeekIndex: 0,
    activeOfficialTemplateDayIndex: null, officialTemplateDetail: detail,
    resistanceTemplates: [{ id: "hypertrophy-3", goal: "hypertrophy", name: "增肌", days: 3, minExperience: "beginner", conditions: "初学者及以上", conditionsEn: "Beginner or above" }],
    getGoalPrescription: () => ({ baseSetCount: 3, load: "67-85% 1RM", rm: "6-12 RM", reps: "6-12 次", setRange: "3-6 组", rest: "30-90 秒" }),
    createPeriodization: () => [
      { label: "第 1 周", title: "动作适应周", focus: "熟悉动作", sets: 2, reps: "8-12 次", rm: "8-12 RM", load: "70% 1RM", rest: "30-90 秒" },
      { label: "第 2 周", title: "容量递进周", focus: "逐渐加量", sets: 3, reps: "8-10 次", rm: "8-10 RM", load: "75% 1RM", rest: "30-90 秒" }
    ],
    makeHypertrophySplit: () => [["全身训练", "上下肢复合动作"]],
    getWorkoutExercises: () => [{ name: "杠铃深蹲", prescription: "3 组 × 8 次", rest: "60 秒" }],
    assessRisk: () => ({ level: "low" }), translateInterfaceText: (value) => value,
    escapeLogText: (value) => value, formatPeriodIntensity: (value) => `强度 ${value}`,
    displayLoadAdvice: (value) => value
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.render = renderOfficialTemplateDetail;`, context);
  context.render();
  assert.match(detail.innerHTML, /初学者及以上/);
  assert.match(detail.innerHTML, /全身训练/);
  assert.match(detail.innerHTML, /动作适应周/);
  assert.match(detail.innerHTML, /class="plan-metric-grid"/);
  assert.match(detail.innerHTML, /class="periodization-grid"/);
  assert.match(detail.innerHTML, /class="week-schedule"/);
  assert.match(detail.innerHTML, /class="plan-grid"/);
  assert.match(detail.innerHTML, /负荷规则/);
  assert.match(detail.innerHTML, /data-official-template-week="1"/);
  assert.match(detail.innerHTML, /data-official-template-day="0"/);
  assert.match(detail.innerHTML, /data-official-template-use="hypertrophy-3"/);
  assert.ok(detail.innerHTML.lastIndexOf("使用该计划") > detail.innerHTML.lastIndexOf("动作适应周"));
  context.activeOfficialTemplateWeekIndex = 1;
  context.activeOfficialTemplateDayIndex = 0;
  context.render();
  assert.match(detail.innerHTML, /容量递进周/);
  assert.match(detail.innerHTML, /杠铃深蹲/);
  assert.match(detail.innerHTML, /data-official-template-day="0" aria-expanded="true"/);
  context.appLanguage = "en";
  context.render();
  assert.match(detail.innerHTML, /Hypertrophy · 3 days\/week/);
  assert.match(detail.innerHTML, /Beginner or above/);
  assert.match(detail.innerHTML, /Use this plan/);
  assert.doesNotMatch(source, /id="planTemplateFormCancel"/);
});

test("first official template use guides profile selection before confirmation and saving", () => {
  const start = source.indexOf("function clearPendingOfficialTemplate() {");
  const end = source.indexOf("function applyHistoryPlanTemplate(index)", start);
  const fields = new Map([
    ["#goal", { value: "strength" }], ["#trainingDays", { value: "3" }],
    ["#experience", { value: "", focus() {} }]
  ]);
  for (const id of ["planTemplateDialogTitle", "planTemplateDialogConditions", "planTemplateDialogProfile", "planTemplateDialogStatus", "planTemplateDialogContinue", "planTemplateDialogCancel", "planTemplateDialogClose"]) {
    fields.set(`#${id}`, { textContent: "", setAttribute() {} });
  }
  const submit = { textContent: "" };
  const dialog = { dataset: {}, open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const hint = { hidden: true, textContent: "" };
  let saves = 0;
  const context = {
    appLanguage: "zh", pendingOfficialTemplateId: null, activePlanWeekIndex: 2, isEditingPlan: false,
    resistanceTemplates: [{ id: "hypertrophy-4", goal: "hypertrophy", days: 4, minExperience: "intermediate", conditions: "中级及以上" }],
    assessRisk: () => ({ level: "low" }),
    localStorage: { getItem: () => null },
    window: { location: { hash: "" }, requestAnimationFrame(callback) { callback(); } },
    document: { querySelector: (selector) => fields.get(selector) },
    form: { querySelector: () => submit }, planTemplateDialog: dialog,
    planTemplateFormHint: hint,
    profileEditor: { scrollIntoView() {} },
    getProfile: () => ({ experience: fields.get("#experience").value || "beginner", days: Number(fields.get("#trainingDays").value) }),
    officialTemplateMismatch: (template, profile) => profile.experience === "intermediate" && profile.days >= template.days ? "" : "请调整选项",
    experienceLabels: { beginner: "初学者", intermediate: "中级" },
    hasGeneratedPlan: () => false, saveCurrentPlan: () => { saves++; },
    renderPlan() {}, renderHome() {}, setPlanPane() {}
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.request = requestOfficialTemplate; this.confirm = showOfficialTemplateConfirmation; this.apply = applyResistanceTemplate;`, context);
  context.request("hypertrophy-4");
  assert.equal(saves, 0);
  assert.equal(context.pendingOfficialTemplateId, "hypertrophy-4");
  assert.equal(fields.get("#trainingDays").value, "4");
  assert.equal(hint.hidden, false);
  context.confirm("hypertrophy-4");
  assert.equal(dialog.dataset.needsAdjustment, "true");
  assert.equal(saves, 0);
  dialog.close();
  fields.get("#experience").value = "intermediate";
  context.confirm("hypertrophy-4");
  assert.equal(dialog.open, true);
  assert.equal(dialog.dataset.needsAdjustment, "false");
  assert.equal(saves, 0);
  context.apply("hypertrophy-4");
  assert.equal(saves, 1);
  assert.equal(context.pendingOfficialTemplateId, null);
  assert.equal(hint.hidden, true);
});

test("unchanged plan submit opens a dialog and OK returns to the plan page", () => {
  const noticeStart = source.indexOf("function showPlanNotice(kind) {");
  const noticeEnd = source.indexOf("function saveCurrentPlan(", noticeStart);
  const submitStart = source.indexOf('form.addEventListener("submit", (event) => {');
  const submitEnd = source.indexOf('document.querySelector("#runRisk")', submitStart);
  const confirmStart = source.indexOf('document.querySelector("#planNoticeConfirm").addEventListener("click", () => {');
  const confirmEnd = source.indexOf('resistanceTemplateList?.addEventListener', confirmStart);
  const planModule = source.slice(source.indexOf('<section class="panel section module-panel" id="plan"'), source.indexOf('<section class="panel section module-panel" id="plan-edit"'));
  assert.ok(noticeStart > 0 && noticeEnd > noticeStart && submitStart > 0 && submitEnd > submitStart);
  assert.ok(confirmStart > 0 && confirmEnd > confirmStart);
  assert.match(source, /document\.querySelector\("#planEditFormHost"\)\.append\(profileEditor\)/);
  assert.doesNotMatch(planModule, /id="planEditorStatus"/);
  assert.match(source, /<form id="profileForm" novalidate>/);
  const listeners = new Map();
  const fields = new Map([
    ["#experience", { value: "intermediate", focus() {} }],
    ["#planNoticeTitle", { textContent: "" }],
    ["#planNoticeConfirm", { textContent: "", addEventListener: (name, callback) => listeners.set(name, callback) }]
  ]);
  const dialog = { dataset: {}, open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  let saved = 0;
  const context = {
    appLanguage: "zh", pendingOfficialTemplateId: null, isEditingPlan: true,
    planNoticeDialog: dialog,
    window: { location: { hash: "plan-edit" } },
    document: { querySelector: (selector) => fields.get(selector) },
    form: { addEventListener: (name, callback) => listeners.set(name, callback) },
    saveCurrentPlan: () => { saved++; return false; },
    renderPlan() {}, setPlanPane() {}
  };
  vm.createContext(context);
  vm.runInContext(source.slice(noticeStart, noticeEnd) + source.slice(submitStart, submitEnd) + source.slice(confirmStart, confirmEnd), context);
  let prevented = false;
  listeners.get("submit")({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(saved, 1);
  assert.equal(dialog.open, true);
  assert.equal(fields.get("#planNoticeTitle").textContent, "已有相同计划");
  listeners.get("click")();
  assert.equal(dialog.open, false);
  assert.equal(context.window.location.hash, "plan");
  assert.equal(context.isEditingPlan, false);
  fields.get("#experience").value = "";
  listeners.get("submit")({ preventDefault() {} });
  assert.equal(saved, 1);
  assert.equal(dialog.open, true);
  assert.equal(fields.get("#planNoticeTitle").textContent, "请选择训练经验");
});

test("the final saved exercise collapses its data panel", () => {
  const start = source.indexOf("function openNextWorkoutLog(exerciseIndex)");
  const end = source.indexOf("function openWorkoutDetail(weekIndex, dayIndex", start);
  assert.ok(start > 0 && end > start);
  const panel = { hidden: false };
  const toggle = { attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
  const context = {
    activeWorkoutDay: { id: "today", exercises: [{ id: "a" }, { id: "b" }] },
    libraryExerciseForWorkout: (item) => item,
    getPlanExerciseLog: () => null,
    hasRecordedPlanExerciseData: () => false,
    workoutDetail: { querySelector: (selector) => selector.includes("panel") ? panel : toggle },
    window: { setTimeout() { throw new Error("No next exercise should be opened"); } }
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.openNext = openNextWorkoutLog;`, context);
  context.openNext(1);
  assert.equal(panel.hidden, true);
  assert.equal(toggle.attributes["aria-expanded"], "false");
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
  assert.deepEqual(Array.from(grid.innerHTML.matchAll(/<strong>(\d{2}-\d{2}) –/g), (match) => match[1]),
    ["10-26", "10-19", "10-12", "10-05"]);
  assert.match(grid.innerHTML, /胸部<\/span><strong>4 sets/);
  assert.doesNotMatch(grid.innerHTML, /6 sets/);
});
