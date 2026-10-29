import { readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../index.html", import.meta.url), "utf8");
const exercises = JSON.parse(await readFile(new URL("../data/exercises-v1.json", import.meta.url), "utf8"));
const fragment = (start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error(`Missing code section: ${start}`);
  return source.slice(a, b);
};
const context = {
  localStorage: { getItem: () => null }, resistanceTemplates: [],
  getPlanRisk: () => ({ level: "low" }),
  focusAreaLabels: {}, focusPurposeLabels: {},
  resistanceExercises: exercises.filter((exercise) => exercise.libraryType === "resistance"),
  focusAreaDisplayName: () => "", focusPurposeDisplayName: () => ""
};
vm.createContext(context);
vm.runInContext([
  fragment("function getGoalPrescription(", "function parseLocalDate("),
  fragment("const focusAreaDefinitions = {", "function getLegacyTargetedPreparation(")
].join("\n"), context);

const goals = { hypertrophy: "增肌", strength: "力量", endurance: "肌耐力", power: "爆发力" };
const experiences = { beginner: "初学", intermediate: "中级", advanced: "高级" };
const lines = [
  "# 计划组合实际输出矩阵", "", "此文件由 `node scripts/audit-plan-matrix.mjs` 依据当前工作区代码生成。基线：低风险、无重点部位、无官方模板、默认动作，显示第 1 周主项；未包含用户替换、去重兜底及历史计划。初学者四天以上和爆发力由交互与保存层拦截，故标记为拦截。", "",
  "| 目标 | 经验 | 每周天数 | 结果 | 第 1 周主项 | 每个训练日标题 → 首个动作 |", "| --- | --- | ---: | --- | --- | --- |"
];
for (const [goal, goalLabel] of Object.entries(goals)) {
  for (const [experience, experienceLabel] of Object.entries(experiences)) {
    for (let days = 2; days <= 6; days++) {
      if (experience === "beginner" && (days >= 4 || goal === "power")) {
        const reason = days >= 4 ? "初学者天数冲突" : "初学者爆发力冲突";
        lines.push(`| ${goalLabel} | ${experienceLabel} | ${days} | 拦截：${reason} | — | — |`);
        continue;
      }
      const plan = context.buildPlan({ goal, experience, days, planRuleVersion: 2, focusArea: "", focusPurpose: "" });
      const period = plan.periodization[0];
      const summary = plan.split.map(([name], index) => {
        const first = context.getWorkoutExercises(index, plan, 0)[0];
        return `${name} → ${first?.name || "无动作"}`;
      }).join("<br>");
      lines.push(`| ${goalLabel} | ${experienceLabel} | ${days} | 生成 ${plan.split.length} 日 | ${period.sets} 组 × ${period.reps}；${period.load} | ${summary} |`);
    }
  }
}
lines.push("", "此矩阵用于发现标题、频率和动作首项的异常，不证明完整动作库标签、肌群覆盖、风险适配或教材合规性。", "");
await writeFile(new URL("../docs/PLAN_GENERATION_MATRIX_ZH.md", import.meta.url), lines.join("\n"));
console.log(`已生成 ${Object.keys(goals).length * Object.keys(experiences).length * 5} 个组合。`);
