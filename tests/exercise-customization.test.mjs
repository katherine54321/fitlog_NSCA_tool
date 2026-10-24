import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");

const planLogHelperStart = source.indexOf("function hasRecordedPlanExerciseData(planLog)");
const planLogHelperEnd = source.indexOf("function getWorkoutSetEntries", planLogHelperStart);
const hasRecordedPlanExerciseData = new Function(
  `${source.slice(planLogHelperStart, planLogHelperEnd)}; return hasRecordedPlanExerciseData;`
)();

test("generated workout actions can be replaced by exercises from the same body category", () => {
  assert.match(source, /PLAN_EXERCISE_REPLACEMENTS_KEY = "fitlog-plan-exercise-replacements"/);
  assert.match(source, /data-replace-workout-exercise="\$\{index\}"/);
  assert.match(source, /function openWorkoutExerciseReplacement\(exerciseIndex\)/);
  assert.match(source, /resistanceExercises\.filter\(\(exercise\) => exercise\.category === category && exercise\.id !== currentExerciseId\)/);
  assert.match(source, /replacement\.category !== exerciseReplacementContext\.category/);
  assert.match(source, /applyPlanExerciseReplacements\(id, getWorkoutExercises\(dayIndex, plan, weekIndex\)\)/);
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
});
