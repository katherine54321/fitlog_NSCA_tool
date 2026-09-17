import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("data record page provides set logging, Brzycki estimate, filtering, and export", () => {
  assert.match(source, /id="setLogForm"/);
  assert.match(source, /id="setLogExercise"/);
  assert.match(source, /id="setLogWeight"/);
  assert.match(source, /id="setLogReps"/);
  assert.match(source, /id="setLogSetNumber"/);
  assert.match(source, /function calculateBrzyckiOneRm/);
  assert.match(source, /1\.0278 - 0\.0278 \* reps/);
  assert.match(source, /fitlog-training-set-logs/);
  assert.match(source, /id="completedTrainingFilter"/);
});

test("action record page includes an overload monitor sourced from the same logs", () => {
  assert.match(source, /id="recordTabs"/);
  assert.match(source, /data-record-tab="actionRecordPane"/);
  assert.match(source, /data-record-tab="trainingRecordPane"/);
  assert.match(source, /id="overloadMonitor"/);
  assert.match(source, /id="overloadExerciseSelect"/);
  assert.match(source, /id="overloadChart"/);
  assert.match(source, /function renderOverloadMonitor/);
  assert.match(source, /连续两次训练的最后一组均比计划次数上限多完成 2 次/);
  assert.match(source, /renderOverloadMonitor\(\)/);
});

test("completed workouts synchronize into the training record pane", () => {
  assert.match(source, /function syncCompletedWorkoutToDataLogs/);
  assert.match(source, /syncCompletedWorkoutToDataLogs\(activeWorkoutDay\)/);
  assert.match(source, /id="completedTrainingList"/);
  assert.match(source, /function getCompletedTrainingActions/);
});

test("strength progress follows the action selected in the record form", () => {
  assert.match(source, /renderOverloadMonitor\(setLogExercise\.value\)/);
  assert.match(source, /setLogExercise\?\.addEventListener\("change"/);
  assert.match(source, /submitButton\.textContent = "已保存"/);
  assert.match(source, /补充数据/);
});

test("four-week wave contains target-specific load progressions and a deload", () => {
  assert.match(source, /80-82\.5% 1RM/);
  assert.match(source, /90-93% 1RM/);
  assert.match(source, /65-70% 1RM/);
  assert.match(source, /55-60% 1RM/);
});
