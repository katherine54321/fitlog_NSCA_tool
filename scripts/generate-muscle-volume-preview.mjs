import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
const source = await readFile(resolve(root, "index.html"), "utf8");
const cssStart = source.indexOf(".muscle-volume { margin-top:");
const cssEnd = source.indexOf(".workout-schedule-actions {", cssStart);
const functionStart = source.indexOf("function renderMuscleVolume()");
const functionEnd = source.indexOf("function renderRecords()", functionStart);
if ([cssStart, cssEnd, functionStart, functionEnd].some((index) => index < 0)) throw new Error("Muscle-volume source not found");

const grid = { innerHTML: "" };
const note = { textContent: "" };
const context = {
  document: { querySelector: (selector) => selector === "#muscleVolumeGrid" ? grid : note },
  appLanguage: "zh",
  today: "2026-10-29",
  trainingSetLogs: [
    { date: "2026-10-27", exerciseId: "press", sets: 4, weightKg: 20, reps: 8 },
    { date: "2026-10-29", exerciseId: "row", sets: 4, weightKg: 25, reps: 10 },
    { date: "2026-10-20", exerciseId: "press", sets: 4, weightKg: 17.5, reps: 9 },
    { date: "2026-10-22", exerciseId: "row", sets: 4, weightKg: 22.5, reps: 10 },
    { date: "2026-10-23", exerciseId: "squat", sets: 4, weightKg: 40, reps: 8 },
    { date: "2026-10-13", exerciseId: "press", sets: 3, weightKg: 15, reps: 10 },
    { date: "2026-10-15", exerciseId: "row", sets: 3, weightKg: 20, reps: 10 }
  ],
  getLoggableExercises: () => [
    { id: "press", primaryMuscles: ["胸部"] },
    { id: "row", primaryMuscles: ["背部"] },
    { id: "squat", primaryMuscles: ["股四头肌"] }
  ],
  escapeLogText: (value) => value,
  translateInterfaceText: (value) => value,
  parseLocalDate: (value) => new Date(`${value}T12:00:00`),
  formatLocalDate: (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
  addDays: (value, amount) => {
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + amount);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
};
vm.createContext(context);
vm.runInContext(`${source.slice(functionStart, functionEnd)}\nrenderMuscleVolume();`, context);

const outputDir = resolve(root, "docs", "previews");
await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, "muscle-volume-demo.html"), `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FitMine 肌群有效组数示例</title><style>
:root { --panel:#181a1b; --surface-soft:#16191a; --text-strong:#f3f8f4; --text-secondary:#99a49f; --border-subtle:#2b3130; --brand:#39ff14; --brand-accent:#00e5ff; }
* { box-sizing:border-box; } body { margin:0; padding:20px 12px 40px; background:#121212; color:var(--text-strong); font:14px system-ui,-apple-system,"Segoe UI",sans-serif; }
main { max-width:430px; margin:auto; } .preview-label { margin:0 0 2px 4px; color:var(--text-secondary); font-size:12px; }
${source.slice(cssStart, cssEnd)}
</style></head><body><main><p class="preview-label">FitMine · 示例数据，仅供视觉检查</p><section class="muscle-volume" aria-labelledby="muscleVolumeTitle"><h3 id="muscleVolumeTitle">每周肌群有效组数</h3><p>${note.textContent}</p><div class="muscle-volume-grid">${grid.innerHTML}</div></section></main></body></html>`.replace(/[ \t]+$/gm, ""), "utf8");
console.log(resolve(outputDir, "muscle-volume-demo.html"));
