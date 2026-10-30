import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
const exerciseData = JSON.parse(await readFile(new URL("../data/exercises-v1.json", import.meta.url), "utf8"));

test("plan generator supports core inputs plus one optional focus area and goal", () => {
  assert.match(source, /<select id="goal" required>/);
  assert.match(source, /<option value="hypertrophy">增肌 · 增加肌肉量<\/option>/);
  assert.match(source, /<option value="endurance">肌耐力 · 提升肌肉抗疲劳能力<\/option>/);
  assert.match(source, /<option value="strength">力量 · 提高最大力量<\/option>/);
  assert.match(source, /<option value="power" disabled>爆发力 · 暂不可用/);
  assert.doesNotMatch(source, /<option value="health">/);
  assert.doesNotMatch(source, /<option value="fatloss">/);
  assert.match(source, /<select id="experience" required>/);
  assert.match(source, /<select id="trainingDays">/);
  assert.match(source, /<select id="focusArea">/);
  assert.match(source, /<option value="chest">胸<\/option>/);
  assert.match(source, /<option value="back">背<\/option>/);
  assert.match(source, /<option value="shoulders">肩<\/option>/);
  assert.match(source, /<option value="arms">手臂<\/option>/);
  assert.match(source, /<option value="glutes">臀<\/option>/);
  assert.match(source, /<option value="quadriceps">股四头肌<\/option>/);
  assert.match(source, /<option value="hamstrings">腘绳肌<\/option>/);
  assert.match(source, /<option value="calves">小腿<\/option>/);
  assert.match(source, /<option value="core">核心<\/option>/);
  assert.match(source, /<select id="focusPurpose">/);
  assert.match(source, /<option value="strength">提升力量<\/option>/);
  assert.match(source, /<option value="hypertrophy">增加肌肉<\/option>/);
  assert.match(source, /<option value="stability">提高稳定性<\/option>/);
  assert.match(source, /训练历史/);
  assert.match(source, /规律抗阻 &lt; 6 个月/);
  assert.match(source, /规律抗阻 6-12 个月/);
  assert.match(source, /系统抗阻 &gt; 1 年/);
  assert.match(source, /可按需设置一个重点部位与加强目的/);
  assert.doesNotMatch(source, /data-plan-tab="templatePlanPane"/);
});

test("focus plan rules preserve movement patterns, prioritize compounds, and add two to four weekly sets", () => {
  assert.match(source, /focusArea: value\("#focusArea"\)/);
  assert.match(source, /focusPurpose: value\("#focusPurpose"\)/);
  assert.match(source, /const focusAreaDefinitions = \{/);
  assert.match(source, /function applyFocusEmphasis\(exercises, dayIndex, program, plan, period\)/);
  assert.match(source, /if \(!plan\.focusArea \|\| !plan\.focusPurpose \|\| plan\.risk\.level === "high"\) return exercises/);
  assert.match(source, /const adjusted = exercises\.map\(\(exercise\) => \(\{ \.\.\.exercise \}\)\)/);
  assert.match(source, /adjusted\.unshift\(adjusted\.splice\(primaryIndex, 1\)\[0\]\)/);
  assert.match(source, /plan\.experience === "advanced" \? 4 : 3/);
  assert.match(source, /period\?\.title === "减载巩固周" \? 2/);
  assert.match(source, /isFocusBonus: true/);
  assert.match(source, /每周增加 2-4 个有效组/);
});

test("focus plan behavior retains every base exercise and adds the expected purpose-specific volume", () => {
  const start = source.indexOf("const focusAreaDefinitions = {");
  const end = source.indexOf("function getWorkoutExercises", start);
  assert.ok(start >= 0 && end > start);
  const context = {
    resistanceExercises: exerciseData.filter((exercise) => exercise.libraryType === "resistance"),
    focusAreaLabels: { chest: "胸" },
    focusPurposeLabels: { strength: "提升力量", hypertrophy: "增加肌肉", stability: "提高稳定性" },
    focusAreaDisplayName: () => "胸",
    focusPurposeDisplayName: (purpose) => ({ strength: "提升力量", hypertrophy: "增加肌肉", stability: "提高稳定性" })[purpose]
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.applyFocusEmphasis = applyFocusEmphasis;`, context);
  const base = [
    { name: "腿举", focus: "复合主项 · 股四头肌", exerciseId: "leg-press" },
    { name: "哑铃卧推", focus: "复合主项 · 胸大肌", exerciseId: "dumbbell-bench-press" },
    { name: "胸托哑铃划船", focus: "复合主项 · 背部", exerciseId: "one-arm-dumbbell-row" },
    { name: "俯卧腿弯举", focus: "孤立补量 · 腘绳肌", exerciseId: "lying-leg-curls" }
  ];
  const program = [base.map((exercise) => [exercise.name, exercise.focus])];
  const period = { title: "容量递进周" };
  const plan = { focusArea: "chest", focusPurpose: "hypertrophy", experience: "intermediate", risk: { level: "low" } };
  const focused = context.applyFocusEmphasis(base, 0, program, plan, period);
  assert.equal(focused[0].name, "哑铃卧推");
  assert.equal(focused.length, base.length + 1);
  base.forEach((exercise) => assert.ok(focused.some((item) => item.name === exercise.name)));
  assert.equal(focused.at(-1).isFocusBonus, true);
  assert.equal(focused.at(-1).sets, 3);
  assert.match(focused.at(-1).prescription, /^3 组 × 8-12 次$/);

  const strength = context.applyFocusEmphasis(base, 0, program, { ...plan, focusPurpose: "strength" }, period);
  assert.equal(strength.at(-1).sets, 2);
  assert.match(strength.at(-1).prescription, /^2 组 × 3-6 次$/);
  const deload = context.applyFocusEmphasis(base, 0, program, { ...plan, experience: "advanced" }, { title: "减载巩固周" });
  assert.equal(deload.at(-1).sets, 2);
  assert.deepEqual(context.applyFocusEmphasis(base, 0, program, { ...plan, focusArea: "" }, period), base);
  assert.deepEqual(context.applyFocusEmphasis(base, 0, program, { ...plan, risk: { level: "high" } }, period), base);
});

test("saved weekly training days restore into the trainingDays control", () => {
  assert.match(source, /const profileFieldIds = \{ days: "trainingDays" \}/);
  assert.match(source, /querySelector\(`#\$\{profileFieldIds\[key\] \|\| key\}`\)/);
});

test("dark exercise details use high-contrast theme colors", () => {
  assert.match(source, /\.exercise-detail-fact b\s*\{\s*color: var\(--brand\);/);
  assert.match(source, /\.exercise-muscle-list li,\s*\.exercise-steps li\s*\{\s*color: var\(--text-strong\);/);
});

test("four-week plan exposes progressive and deload microcycles", () => {
  assert.match(source, /function createPeriodization/);
  assert.match(source, /动作适应周/);
  assert.match(source, /容量递进周/);
  assert.match(source, /目标强化周/);
  assert.match(source, /减载巩固周/);
  assert.match(source, /id="periodizationWeeks"/);
  assert.match(source, /data-period-week/);
  assert.match(source, /训练组数减少约 40%-50%/);
});

test("workout prescriptions receive the selected week period", () => {
  assert.match(source, /function getWorkoutExercises\(dayIndex, plan, weekIndex = 0\)/);
  assert.match(source, /getWorkoutExercises\(dayIndex, plan, weekIndex\)/);
  assert.match(source, /workout\.period\?\.title/);
});

test("warm-ups follow the actual workout movement pattern", () => {
  const start = source.indexOf("function getWorkoutPreparationPattern(workout)");
  const end = source.indexOf("function savePlanExerciseReplacements", start);
  assert.ok(start >= 0 && end > start);
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.getTargetedPreparation = getTargetedPreparation;`, context);

  const lowerDay = {
    name: "下肢推拉与深蹲发展",
    description: "股四头肌、臀肌、腘绳肌与小腿；深蹲模式为主",
    exercises: [
      { name: "腿举", focus: "下肢 A · 股四头肌" },
      { name: "保加利亚分腿蹲", focus: "下肢 A · 单腿臀腿" },
      { name: "俯卧腿弯举", focus: "下肢 A · 腘绳肌" },
      { name: "站姿提踵", focus: "下肢 A · 小腿" }
    ]
  };
  const lowerWarmups = Array.from(context.getTargetedPreparation(lowerDay).warmups, (item) => item.exerciseId);
  assert.deepEqual(lowerWarmups, ["ankle-circles", "worlds-greatest-stretch"]);
  assert.ok(!lowerWarmups.includes("arm-circles"));

  const posteriorDay = {
    name: "下肢髋主导与后链发展",
    description: "臀肌和腘绳肌；髋主导为主",
    exercises: [
      { name: "罗马尼亚硬拉", focus: "腿 B · 腘绳肌" },
      { name: "杠铃臀推", focus: "腿 B · 臀大肌" },
      { name: "坐姿腿弯举", focus: "腿 B · 腘绳肌" }
    ]
  };
  assert.deepEqual(
    Array.from(context.getTargetedPreparation(posteriorDay).warmups, (item) => item.exerciseId),
    ["standing-hip-circles", "inchworm"]
  );
});

test("generated workout days enforce unique exercise identities", () => {
  assert.match(source, /function ensureUniqueWorkoutExercises\(exercises\)/);
  assert.match(source, /ensureUniqueWorkoutExercises\(applyPlanExerciseReplacements\(id, generatedExercises\)\)/);
  assert.match(source, /"站姿提踵": "standing-calf-raises"/);
  assert.match(source, /"哑铃卧推": "dumbbell-bench-press"/);
  assert.match(source, /"绳索夹胸": "cable-crossover"/);

  const start = source.indexOf("function getWorkoutLibraryExercise(item)");
  const end = source.indexOf("function getWorkoutDay", start);
  assert.ok(start >= 0 && end > start);
  const context = {
    workoutExerciseAliases: {},
    resistanceExercises: [
      { id: "squat", nameZh: "深蹲", category: "腿部", primaryMuscles: ["股四头肌"], mechanic: "复合动作", force: "推", instructionsZh: ["稳定下蹲。"] },
      { id: "split-squat", nameZh: "分腿蹲", category: "腿部", primaryMuscles: ["股四头肌"], mechanic: "复合动作", force: "推", instructionsZh: ["保持膝盖稳定。"] },
      { id: "curl", nameZh: "腿弯举", category: "腿部", primaryMuscles: ["腘绳肌"], mechanic: "孤立动作", force: "拉", instructionsZh: ["控制回放。"] }
    ]
  };
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nthis.ensureUniqueWorkoutExercises = ensureUniqueWorkoutExercises;`, context);
  const unique = context.ensureUniqueWorkoutExercises([
    { name: "深蹲", exerciseId: "squat", prescription: "3 组 × 8 次" },
    { name: "重复深蹲", exerciseId: "squat", prescription: "3 组 × 8 次" },
    { name: "腿弯举", exerciseId: "curl", prescription: "2 组 × 10 次" }
  ]);
  assert.equal(unique.length, 3);
  assert.equal(new Set(unique.map((item) => item.exerciseId)).size, 3);
  assert.equal(unique[1].exerciseId, "split-squat");
});

test("hypertrophy splits follow novice full body, intermediate upper lower, and advanced PPL structures", () => {
  assert.match(source, /function makeHypertrophySplit/);
  assert.match(source, /全身复合力量与动作基础/);
  assert.match(source, /上肢推拉大力量/);
  assert.match(source, /下肢推拉与深蹲发展/);
  assert.match(source, /上肢容量与肩胛平衡/);
  assert.match(source, /下肢髋主导与后链发展/);
  assert.match(source, /胸肩推举与肱三头力量/);
  assert.match(source, /背阔肌划船与手臂补量/);
  assert.match(source, /髋主导臀腿后侧发展/);
  assert.match(source, /<option value="6">每周 6 天<\/option>/);
  assert.match(source, /const pplHypertrophyTemplates/);
});

test("program design centralizes goal prescriptions and recovery-aware split selection", () => {
  assert.match(source, /function getGoalPrescription/);
  assert.match(source, /67-85% 1RM/);
  assert.match(source, /≥85% 1RM/);
  assert.match(source, /75-90% 1RM/);
  assert.match(source, /≤67% 1RM/);
  assert.match(source, /function getPlanSelectionConflict\(profile\)/);
  assert.match(source, /if \(Number\(profile\.days\) >= 4\) return "beginnerDays"/);
  assert.match(source, /if \(profile\.goal === "power"\) return "beginnerPower"/);
  assert.match(source, /2-for-2/);
  assert.match(source, /至少 48 小时恢复时间/);
});

test("plan schedule days open the selected week workout detail without verbose guidance", () => {
  assert.match(source, /data-plan-day/);
  assert.match(source, /openWorkoutDetail\(activePlanWeekIndex, Number\(button\.dataset\.planDay\), "plan"\)/);
  assert.doesNotMatch(source, /当前训练天数采用过渡编排/);
  assert.doesNotMatch(source, /四周计划已按目标、体能水平与每周/);
});

test("home today plan mirrors plan titles and exposes the next workout on rest days", () => {
  assert.match(source, /id="homeTodayScheduleTitle">今日计划<\/strong>/);
  assert.match(source, /function getScheduledPlanDays/);
  assert.match(source, /Training day \$\{todayWorkout\.dayIndex \+ 1\}/);
  assert.match(source, /data-view-day data-week-index="\$\{todayWorkout\.weekIndex\}"/);
  assert.match(source, /completed \? "View details" : "Start workout"/);
  assert.match(source, /appLanguage === "en" \? "Rest day" : "休息日"/);
  assert.match(source, /下个训练日计划/);
  assert.match(source, /4: \[1, 2, 4, 5\]/);
  assert.match(source, /5: \[1, 2, 3, 5, 6\]/);
});

test("home calendar marks the next 28 days of the saved plan and opens workout details", () => {
  assert.match(source, /id="homeTrainingCalendarTitle">训练日历<\/strong>/);
  assert.match(source, /id="homeTrainingCalendarGrid"/);
  assert.match(source, /Array\.from\(\{ length: 28 \}/);
  assert.match(source, /class="home-training-calendar-day is-training/);
  assert.match(source, /data-view-day data-week-index="\$\{workout\.weekIndex\}"/);
  assert.match(source, /document\.querySelector\("#home"\)\.addEventListener\("click"/);
});

test("training weekday preferences support recurring and current-week scopes", () => {
  assert.match(source, /id="adjustTrainingDays"/);
  assert.match(source, /id="scheduleWeekdayPicker"/);
  assert.match(source, /保存至本计划（每周）/);
  assert.match(source, /仅保持至本周/);
  assert.match(source, /fitlog-training-day-preferences/);
  assert.match(source, /preferences\.weeklyOverrides\[String\(weekIndex\)\] = selected/);
  assert.match(source, /preferences\.recurring = selected/);
  assert.match(source, /preferences\.weeklyOverrides = \{\}/);
  assert.match(source, /const focusKey = plan\.focusArea \? `-\$\{plan\.focusArea\}-\$\{plan\.focusPurpose\}` : ""/);
  assert.match(source, /return `\$\{startDate\}-\$\{profile\.goal\}-\$\{profile\.experience\}-\$\{plan\.days\}\$\{focusKey\}-w\$\{weekIndex \+ 1\}-d\$\{dayIndex \+ 1\}`/);
});

test("home progress ring uses a dark hollow center", () => {
  assert.match(source, /radial-gradient\(circle at center, var\(--panel\) 54%, transparent 55%\)/);
  assert.doesNotMatch(source, /radial-gradient\(circle at center, #fff 54%, transparent 55%\)/);
});

test("home calendar uses compact circular dates and an unfilled electric-blue today marker", () => {
  assert.match(source, /\.home-training-calendar-day\s*\{[\s\S]*?width: 34px;[\s\S]*?height: 34px;[\s\S]*?border-radius: 50%/);
  assert.match(source, /\.home-training-calendar-grid \.home-training-calendar-day\.is-today\s*\{[\s\S]*?border-color: var\(--brand-accent\);[\s\S]*?background: transparent/);
  assert.match(source, /\.schedule-dialog-actions\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});

test("phone plan layout uses its app container instead of the browser viewport", () => {
  assert.match(source, /\.app\s*\{[\s\S]*?container-type: inline-size/);
  assert.match(source, /@container \(min-width: 620px\)/);
  assert.match(source, /grid-auto-columns: minmax\(0, 78%\)/);
});

test("plan metrics preserve readable widths and use compact aligned rows", () => {
  assert.match(source, /@container \(min-width: 620px\)\s*\{\s*:is\(#plan, #plan-template-detail\) \.plan-metric-grid\s*\{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(source, /:is\(#plan, #plan-template-detail\) \.plan-metric strong\s*\{[\s\S]*?white-space: normal;[\s\S]*?overflow-wrap: normal;[\s\S]*?word-break: keep-all;[\s\S]*?text-overflow: clip/);
  assert.match(source, /:is\(#plan, #plan-template-detail\) \.plan-metric\s*\{[\s\S]*?grid-template-rows: 2\.5em auto auto;[\s\S]*?gap: 3px;[\s\S]*?padding: 8px 10px/);
  assert.match(source, /<span>建议负荷<\/span><strong id="planMetricRm">67-85% 1RM<\/strong><small id="planMetricRmNote">约 6-12 RM<\/small>/);
  assert.match(source, /\["建议负荷", "Training load"\]/);
  assert.match(source, /#planMetricRm"\)\.textContent = plan\.load/);
  assert.match(source, /#planMetricRmNote"\)\.textContent = appLanguage === "en" \? `Approx\. \$\{plan\.rm\}` : `约 \$\{plan\.rm\}`/);
});

test("period cards show a compact week hierarchy without a redundant section heading", () => {
  assert.doesNotMatch(source, />四周训练重点</);
  assert.match(source, /aria-label="四周周期安排"/);
  assert.match(source, /<small>Week \$\{String\(index \+ 1\)\.padStart\(2, "0"\)\}<\/small>/);
  assert.match(source, /<strong>\$\{translateInterfaceText\(period\.title\)\}<\/strong>/);
  assert.match(source, /id="activeWeekKicker"/);
  assert.match(source, /:is\(#plan, #plan-template-detail\) \.periodization-grid\s*\{[\s\S]*?grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(source, /:is\(#plan, #plan-template-detail\) \.period-card strong\s*\{[\s\S]*?font-size: clamp\(9px, 2\.4cqw, 11px\)[\s\S]*?-webkit-line-clamp: unset/);
});
