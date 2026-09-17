import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("plan generator uses only resistance goal, training history, and weekly training days", () => {
  assert.match(source, /<select id="goal">/);
  assert.match(source, /<option value="hypertrophy">增肌<\/option>/);
  assert.match(source, /<option value="endurance">肌耐力<\/option>/);
  assert.match(source, /<option value="strength">力量<\/option>/);
  assert.match(source, /<option value="power">爆发力<\/option>/);
  assert.doesNotMatch(source, /<option value="health">/);
  assert.doesNotMatch(source, /<option value="fatloss">/);
  assert.match(source, /<select id="experience">/);
  assert.match(source, /<select id="trainingDays">/);
  assert.match(source, /训练历史/);
  assert.match(source, /规律抗阻 &lt; 6 个月/);
  assert.match(source, /规律抗阻 6-12 个月/);
  assert.match(source, /系统抗阻 &gt; 1 年/);
  assert.match(source, /选择三项信息，生成周期训练计划/);
  assert.doesNotMatch(source, /data-plan-tab="templatePlanPane"/);
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
  assert.match(source, /profile\.experience === "beginner"\s*\? Math\.min\(3, requestedDays\)/);
  assert.match(source, /2-for-2/);
  assert.match(source, /至少 48 小时恢复时间/);
});

test("plan schedule days open the selected week workout detail without verbose guidance", () => {
  assert.match(source, /data-plan-day/);
  assert.match(source, /openWorkoutDetail\(activePlanWeekIndex, Number\(button\.dataset\.planDay\)\)/);
  assert.doesNotMatch(source, /当前训练天数采用过渡编排/);
  assert.doesNotMatch(source, /四周计划已按目标、体能水平与每周/);
});

test("phone plan layout uses its app container instead of the browser viewport", () => {
  assert.match(source, /\.app\s*\{[\s\S]*?container-type: inline-size/);
  assert.match(source, /@container \(min-width: 620px\)/);
  assert.match(source, /grid-auto-columns: minmax\(0, 78%\)/);
});

test("plan metrics preserve readable widths and contain long values", () => {
  assert.match(source, /@container \(min-width: 620px\)\s*\{\s*#plan \.plan-metric-grid\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(source, /@container \(min-width: 820px\)\s*\{\s*#plan \.plan-metric-grid\s*\{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(source, /#plan \.plan-metric strong\s*\{[\s\S]*?overflow: hidden;[\s\S]*?text-overflow: ellipsis/);
});

test("period cards show a compact week hierarchy without a redundant section heading", () => {
  assert.doesNotMatch(source, />四周训练重点</);
  assert.match(source, /aria-label="四周周期安排"/);
  assert.match(source, /<small>Week \$\{String\(index \+ 1\)\.padStart\(2, "0"\)\}<\/small>/);
  assert.match(source, /<strong>\$\{period\.title\}<\/strong>/);
  assert.match(source, /id="activeWeekKicker"/);
});
