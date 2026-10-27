import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("data record page provides set logging, Brzycki estimate, filtering, and export", () => {
  assert.match(source, /id="setLogForm"/);
  assert.match(source, /id="setLogExercise"/);
  assert.match(source, /id="setLogWeight"/);
  assert.match(source, /id="setLogReps"/);
  assert.match(source, /共几组（可选）<input id="setLogSetCount"[^>]*value="1"/);
  assert.doesNotMatch(source, /例如：第 3 组/);
  assert.match(source, /function calculateBrzyckiOneRm/);
  assert.match(source, /1\.0278 - 0\.0278 \* reps/);
  assert.match(source, /fitlog-training-set-logs/);
  assert.match(source, /id="completedTrainingFilter"/);
});

test("record tabs separate calendar, action insights, and manual data entry", () => {
  assert.match(source, /id="recordTabs"/);
  assert.match(source, /data-record-tab="trainingCalendarPane"/);
  assert.match(source, /data-record-tab="actionRecordPane"/);
  assert.match(source, /data-record-tab="setLogPane">数据录入/);
  assert.doesNotMatch(source, /data-record-tab="trainingRecordPane"/);
  assert.match(source, /id="actionRecordPane"[\s\S]*?id="overloadMonitor"[\s\S]*?class="completed-training-history"[\s\S]*?id="setLogPane"/);
  assert.match(source, /id="setLogPane"[\s\S]*?id="setLogForm"/);
  assert.match(source, /id="recordCalendarGrid"/);
  assert.match(source, /function renderRecordCalendar/);
  assert.match(source, /function calendarSessionsForDate/);
  assert.match(source, /record\.planDayId\) && record\.date === dateValue/);
  assert.doesNotMatch(source, /<h2>数据记录<\/h2>/);
  assert.doesNotMatch(source, /id="completedTrainingTitle"/);
  assert.match(source, /id="overloadMonitor"/);
  assert.match(source, /id="overloadExerciseSelect"/);
  assert.match(source, /id="overloadChart"/);
  assert.match(source, /function renderOverloadMonitor/);
  assert.match(source, /连续两次训练的最后一组均比计划次数上限多完成 2 次/);
  assert.match(source, /renderOverloadMonitor\(\)/);
});

test("record calendar uses simple arrows and neutral supplement actions", () => {
  assert.match(source, /\.record-calendar-shell \.calendar-nav button \{[\s\S]*?background: transparent/);
  assert.match(source, /class="record-calendar-month" id="recordCalendarMonth"[\s\S]*?data-record-calendar-nav="1"/);
  assert.match(source, /\.completed-training-supplement \{[\s\S]*?color: #ffffff;[\s\S]*?background: transparent/);
  assert.doesNotMatch(source, /\.completed-training-supplement \{[^}]*color: #00e5ff/);
});

test("completed exercise history aligns filters left and supports name search", () => {
  assert.match(source, /\.completed-training-head \{[^}]*justify-content: flex-start/);
  assert.match(source, /id="completedTrainingFilter"[\s\S]*?id="completedTrainingSearch"/);
  assert.match(source, /const searchTerm = String\(completedTrainingSearch\?\.value/);
  assert.match(source, /exercise\?\.nameZh, exercise\?\.nameEn/);
  assert.match(source, /completedTrainingSearch\?\.addEventListener\("input"/);
});

test("completed workouts synchronize into the training record pane", () => {
  assert.match(source, /function syncCompletedWorkoutToDataLogs/);
  assert.match(source, /syncCompletedWorkoutToDataLogs\(activeWorkoutDay, completedAt\)/);
  assert.match(source, /id="completedTrainingList"/);
  assert.match(source, /function getCompletedTrainingActions/);
});

test("manual data entry synchronizes into exercise history with total sets", () => {
  assert.match(source, /const manualLogs = trainingSetLogs\.filter/);
  assert.match(source, /return \[\.\.\.planLogs, \.\.\.manualLogs, \.\.\.legacyActions\]/);
  assert.match(source, /source: "manual",[\s\S]*?sets,[\s\S]*?weightKg/);
  assert.match(source, /setLogSetCount\.value = "1"/);
  assert.match(source, /saveTrainingSetLogs\(\);[\s\S]*?window\.FitLogSync\?\.queueSync\?\.\(\);[\s\S]*?renderTrainingRecordSummary\(\)/);
});

test("completed workouts use the actual completion date and open from the record calendar", () => {
  assert.match(source, /function recordFromWorkout\(workout, completedAt = new Date\(\)\)/);
  assert.match(source, /date: completedDate,[\s\S]*?scheduledDate: workout\.date/);
  assert.match(source, /function repairCompletedWorkoutRecords\(\)/);
  assert.match(source, /data-record-calendar-nav="-1"/);
  assert.match(source, /data-record-calendar-date="\$\{dateValue\}"/);
  assert.match(source, /id="recordCalendarDetail"/);
  assert.match(source, /function renderRecordCalendarDetail\(\)/);
  assert.match(source, /data-calendar-supplement-form/);
  assert.match(source, /data-supplement-weight/);
  assert.match(source, /data-supplement-reps/);
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
