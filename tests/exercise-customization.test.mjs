import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");

const planLogHelperStart = source.indexOf("function hasRecordedPlanExerciseData(planLog)");
const planLogHelperEnd = source.indexOf("function getWorkoutSetEntries", planLogHelperStart);
const hasRecordedPlanExerciseData = new Function(
  `${source.slice(planLogHelperStart, planLogHelperEnd)}; return hasRecordedPlanExerciseData;`
)();
const recommendationStart = source.indexOf("function buildProgressionRecommendation(");
const recommendationEnd = source.indexOf("function saveInlineWorkoutLog", recommendationStart);
const buildProgressionRecommendation = new Function(
  `${source.slice(recommendationStart, recommendationEnd)}; return buildProgressionRecommendation;`
)();

test("generated workout actions can be replaced by exercises from the same body category", () => {
  assert.match(source, /PLAN_EXERCISE_REPLACEMENTS_KEY = "fitlog-plan-exercise-replacements"/);
  assert.match(source, /data-replace-workout-exercise="\$\{index\}"/);
  assert.match(source, /function openWorkoutExerciseReplacement\(exerciseIndex\)/);
  assert.match(source, /const usedExerciseIds = new Set\(activeWorkoutDay\.exercises/);
  assert.match(source, /&& !usedExerciseIds\.has\(exercise\.id\)/);
  assert.match(source, /replacement\.category !== exerciseReplacementContext\.category/);
  assert.match(source, /const duplicatesAnotherExercise = activeWorkoutDay\.exercises\.some/);
  assert.match(source, /const generatedExercises = getWorkoutExercises\(dayIndex, plan, weekIndex\)/);
  assert.match(source, /ensureUniqueWorkoutExercises\(applyPlanExerciseReplacements\(id, generatedExercises\)\)/);
  assert.match(source, /localStorage\.setItem\(PLAN_EXERCISE_REPLACEMENTS_KEY, JSON\.stringify\(planExerciseReplacements\)\)/);
});

test("exercise details support persistent favorites and the library lists them below stretching", () => {
  assert.match(source, /FAVORITE_EXERCISES_KEY = "fitlog-favorite-exercises"/);
  assert.match(source, /data-toggle-favorite="\$\{exercise\.id\}"/);
  assert.match(source, /function toggleFavoriteExercise\(exerciseId\)/);
  assert.match(source, /localStorage\.setItem\(FAVORITE_EXERCISES_KEY, JSON\.stringify\(favoriteExerciseIds\)\)/);
  assert.match(source, /data-library-view="stretchPane">拉伸<\/button>[\s\S]*?data-library-view="favoritesPane">收藏<\/button>/);
  assert.match(source, /id="favoritesPane"[\s\S]*?id="favoriteGrid"/);
  assert.match(source, /favoriteExerciseIds[\s\S]*?libraryExercises\.find\(\(exercise\) => exercise\.id === id\)/);
});

test("workout cards use compact overflow actions and inline logging", () => {
  assert.match(source, /data-toggle-workout-menu/);
  assert.match(source, /class="workout-overflow-menu" hidden/);
  assert.match(source, /data-inline-workout-log="\$\{index\}"/);
  assert.match(source, /计划固定 \$\{plannedSets\} 组/);
  assert.match(source, /data-workout-set-row="\$\{index\}"/);
  assert.match(source, /name="weightKg" data-set-weight/);
  assert.match(source, /name="reps" data-set-reps/);
  assert.match(source, /setEntries\.length !== plannedSets/);
  assert.match(source, /setEntries,/);
  assert.match(source, /function saveInlineWorkoutLog\(form\)/);
  assert.match(source, /Workout data saved\./);
  assert.match(source, /Workout log persistence verification failed/);
  assert.match(source, /data-inline-workout-status role="status" aria-live="polite"/);
  assert.match(source, /function hasRecordedPlanExerciseData\(planLog\)/);
  assert.match(source, /hasRecordedData \? \(appLanguage === "en" \? "View data" : "查看数据"\) : \(appLanguage === "en" \? "Log data" : "记录数据"\)/);
  assert.match(source, /if \(toggle\) toggle\.textContent = appLanguage === "en" \? "View data" : "查看数据"/);
  assert.doesNotMatch(source, /planLog \? \(appLanguage === "en" \? "Recorded" : "已记录"\)/);
  assert.match(source, /workoutDetail\.addEventListener\("submit"/);
  assert.doesNotMatch(source, /data-log-workout-exercise="\$\{exercise\.id\}"/);
  assert.doesNotMatch(source, /class="workout-action-actions"/);
});

test("adaptive progression setup and low-friction set logging are available", () => {
  assert.match(source, /ADAPTIVE_SETUP_KEY = "fitlog-adaptive-progression-setup"/);
  assert.match(source, /data-adaptive-setup="known"/);
  assert.match(source, /data-adaptive-setup="guide"/);
  assert.match(source, /data-adaptive-setup="skip"/);
  assert.match(source, /直接使用已知重量/);
  assert.match(source, /通过试做组确定/);
  assert.match(source, /data-calibration-trial-form="\$\{exerciseIndex\}"/);
  assert.match(source, /data-calibration-feedback="easy"/);
  assert.match(source, /data-confirm-calibration="\$\{exerciseIndex\}"/);
  assert.match(source, /data-retry-calibration="\$\{exerciseIndex\}"/);
  assert.match(source, /data-recalibrate-workout-exercise="\$\{index\}"/);
  assert.match(source, /trial sets are not counted as training volume/);
  assert.match(source, /window\.setTimeout\(\(\) => openWorkoutLogPanel\(0, true\), 0\)/);
  assert.match(source, /data-apply-first-set/);
  assert.match(source, /data-toggle-set-complete/);
  assert.match(source, /data-selected-difficulty/);
  assert.match(source, /data-set-difficulty="\$\{value\}"/);
  assert.match(source, /记录主训练数据后，FitMine可为下次训练调整重量。/);
  assert.match(source, /getLatestRecordedExerciseLog\(exercise\.id, activeWorkoutDay\?\.id\)/);
  assert.match(source, /previousEntry\.weightKg \?\? previousLog\?\.weightKg/);
});

test("trial-set guidance produces safe per-exercise calibration decisions", () => {
  const start = source.indexOf("function isLowerBodyCategory(category)");
  const end = source.indexOf("function shouldShowAdaptiveSetup", start);
  assert.ok(start >= 0 && end > start);
  const buildCalibrationRecommendation = new Function(
    `${source.slice(start, end)}; return buildCalibrationRecommendation;`
  )();
  const target = buildCalibrationRecommendation({ weightKg: 20, feedback: "target", category: "胸部" });
  assert.equal(target.action, "confirm");
  assert.equal(target.recommendedWeight, 20);
  const easyUpper = buildCalibrationRecommendation({ weightKg: 20, feedback: "easy", category: "胸部" });
  assert.equal(easyUpper.action, "retry-up");
  assert.equal(easyUpper.recommendedWeight, 21);
  const easyLower = buildCalibrationRecommendation({ weightKg: 40, feedback: "easy", category: "腿部" });
  assert.equal(easyLower.recommendedWeight, 43);
  const hard = buildCalibrationRecommendation({ weightKg: 20, feedback: "hard", category: "背部" });
  assert.equal(hard.action, "retry-down");
  assert.equal(hard.recommendedWeight, 19);
  const pain = buildCalibrationRecommendation({ weightKg: 20, feedback: "pain", category: "腿部" });
  assert.equal(pain.action, "stop");
  assert.equal(pain.recommendedWeight, null);
});

test("progression recommendation follows completion, rep range, and final-set difficulty", () => {
  const sets = (reps, count = 3) => Array.from({ length: count }, (_, index) => ({
    setNumber: index + 1,
    weightKg: 40,
    reps,
    completed: true,
  }));
  assert.equal(buildProgressionRecommendation({
    setEntries: sets(12), plannedSets: 3, repMin: 8, repMax: 12, difficulty: "target", category: "胸部",
  }).action, "increase-load");
  assert.equal(buildProgressionRecommendation({
    setEntries: sets(10), plannedSets: 3, repMin: 8, repMax: 12, difficulty: "easy", category: "胸部",
  }).action, "increase-reps");
  assert.equal(buildProgressionRecommendation({
    setEntries: sets(8), plannedSets: 3, repMin: 8, repMax: 12, difficulty: "hard", category: "背部",
  }).action, "hold");
  assert.equal(buildProgressionRecommendation({
    setEntries: sets(6), plannedSets: 3, repMin: 8, repMax: 12, difficulty: "missed", category: "腿部",
  }).action, "reduce");
  assert.equal(buildProgressionRecommendation({
    setEntries: sets(10), plannedSets: 3, repMin: 8, repMax: 12, difficulty: "pain", category: "腿部",
  }).action, "stop");
});

test("completed-only plan logs do not appear as recorded workout data", () => {
  assert.equal(hasRecordedPlanExerciseData(null), false);
  assert.equal(hasRecordedPlanExerciseData({ weightKg: null, reps: 12, completedAt: "2026-10-24T00:00:00.000Z" }), false);
  assert.equal(hasRecordedPlanExerciseData({ weightKg: 20, reps: 8 }), true);
  assert.equal(hasRecordedPlanExerciseData({
    setEntries: [
      { setNumber: 1, weightKg: 20, reps: 8 },
      { setNumber: 2, weightKg: 20, reps: 8 }
    ]
  }), true);
  assert.equal(hasRecordedPlanExerciseData({
    setEntries: [
      { setNumber: 1, weightKg: 20, reps: 8, completed: true },
      { setNumber: 2, weightKg: null, reps: null, completed: false }
    ]
  }), true);
});
