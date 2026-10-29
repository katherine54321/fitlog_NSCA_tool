import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const library = JSON.parse(await readFile(new URL('../data/exercises-v1.json', import.meta.url), 'utf8'));
function part(a, b) { const i = source.indexOf(a), j = source.indexOf(b, i); if (i < 0 || j < 0) throw Error(a); return source.slice(i, j); }
const ctx = { localStorage: { getItem: () => null }, getPlanRisk: () => ({level:'low'}), focusAreaLabels:{}, focusPurposeLabels:{}, resistanceExercises:library.filter(e=>e.libraryType === 'resistance'), focusAreaDisplayName:()=>'', focusPurposeDisplayName:()=>'' };
vm.createContext(ctx);
vm.runInContext([
  part('const resistanceTemplates = [', 'const assessmentTables = {'),
  part('function getGoalPrescription(', 'function parseLocalDate('),
  part('const focusAreaDefinitions = {', 'function getLegacyTargetedPreparation('),
  part('function getWorkoutLibraryExercise(', 'function getWorkoutDay('),
  part('const workoutExerciseAliases = {', 'function libraryExerciseForWorkout('),
  'this.focusDefinitions = focusAreaDefinitions; this.templates = resistanceTemplates;'
].join('\n'),ctx);
const goals={hypertrophy:'增肌',strength:'力量',endurance:'肌耐力',power:'爆发力'};
const experiences={beginner:'初学',intermediate:'中级',advanced:'高级'};
const lines=['# 当前计划生成：全部组合与主训练动作清单','','由 `node scripts/audit-plan-full-lists.mjs` 读取当前工作区代码生成。基线：低风险、无重点部位、无用户手动替换、第一周。动作名称按计划显示，实际执行去重；不包含热身及拉伸。四周动作通常相同，处方不同。历史数据、旧版本和自选替换可能不同。拦截依据当前表单规则；此表不代表教材合规性。','','| 目标 | 经验 | 天数 | 每日标题和全部主训练动作（按实际顺序） |','| --- | --- | ---: | --- |'];
for (const [g,gl] of Object.entries(goals)) for (const [e,el] of Object.entries(experiences)) for(let d=2;d<=6;d++) {
 if(e==='beginner'&&(d>=4||g==='power')) {lines.push(`| ${gl} | ${el} | ${d} | 当前交互拦截 |`);continue;}
 const p=ctx.buildPlan({goal:g,experience:e,days:d,planRuleVersion:2,focusArea:'',focusPurpose:''},null);
 const cells=p.split.map(([title],i)=>`第${i+1}日 ${title}：${ctx.ensureUniqueWorkoutExercises(ctx.getWorkoutExercises(i,p,0)).map(x=>x.name).join('、')}`);
 lines.push(`| ${gl} | ${el} | ${d} | ${cells.join('<br>')} |`);
}
lines.push('','## 官方模板和旧版模板','','目前官方模板入口为增肌 3 天与增肌 4 天；动作随经验及天数按上表分支生成，不保证所有经验使用同一动作清单。以下另列代码中保留的旧模板；旧模板名称和简介可能与实际动作不同。','','| 模板 | 日数 | 声明的日标题与简介 |','| --- | ---: | --- |');
for (const t of ctx.templates) lines.push(`| ${t.name}（${t.id}） | ${t.days} | ${(t.split||[]).map(([a,b])=>`${a}：${b}`).join('<br>') || '使用常规生成分支，见上表'} |`);
const special=ctx.templates.find(t=>t.id==='chest-shoulders-back-glutes-legs-4');
const p=ctx.buildPlan({goal:'hypertrophy',experience:'intermediate',days:4,planRuleVersion:2,focusArea:'',focusPurpose:''},special.id);
lines.push('','旧模板“胸 / 肩 / 背 / 臀腿四分化”的专用实际动作：',...p.split.map(([title],i)=>`- ${title}：${ctx.ensureUniqueWorkoutExercises(ctx.getWorkoutExercises(i,p,0)).map(x=>x.name).join('、')}`),'','其他旧模板只覆盖日标题与描述，动作仍取上表中目标、经验、天数对应的通用分支；因此简介不一定等于实际清单。','','## 重点部位附加候选','','各目的按列内顺序选择首个在库且当日未重复的动作；选择匹配的重点日追加，匹配复合动作可前移。候选不是所有条件均必然添加；重点、周次、去重和历史替换会影响最终结果。','','| 部位 | 提升力量 | 增加肌肉 | 提高稳定性 |','| --- | --- | --- | --- |');
const names={chest:'胸',back:'背',shoulders:'肩',arms:'手臂',glutes:'臀',quadriceps:'股四头肌',hamstrings:'腘绳肌',calves:'小腿',core:'核心'};
for(const [id,def] of Object.entries(ctx.focusDefinitions)) {const vals=['strength','hypertrophy','stability'].map(k=>def.bonuses[k].map(id=>{const e=ctx.resistanceExercises.find(x=>x.id===id);return `${e?.nameZh||'未在抗阻库找到'}（${id}）`;}).join(' → '));lines.push(`| ${names[id]||id} | ${vals.join(' | ')} |`)}
lines.push('','注意：清单以工作区代码为准；因当前工作区存在未发布修改，不等同于线上实际版本。');
await writeFile(new URL('../docs/PLAN_GENERATION_ALL_EXERCISES_ZH.md',import.meta.url),lines.join('\n')+'\n');
console.log('已生成全部组合及重点候选清单');
