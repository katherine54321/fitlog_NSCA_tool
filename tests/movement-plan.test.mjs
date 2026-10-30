import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../index.html',import.meta.url),'utf8');
const library = JSON.parse(await readFile(new URL('../data/exercises-v1.json',import.meta.url),'utf8'));
function fragment(start,end) { const a=source.indexOf(start),b=source.indexOf(end,a); assert.ok(a>=0&&b>a); return source.slice(a,b); }
const ctx={localStorage:{getItem:()=>null},resistanceTemplates:[],getPlanRisk:()=>({level:'low'}),
  focusAreaLabels:{chest:'胸',back:'背',shoulders:'肩',arms:'手臂',glutes:'臀',quadriceps:'股四头肌',hamstrings:'腘绳肌',calves:'小腿',core:'核心'},focusPurposeLabels:{hypertrophy:'增肌',strength:'力量',stability:'稳定'},
  resistanceExercises:library.filter(e=>e.libraryType==='resistance'),focusAreaDisplayName:()=>'',focusPurposeDisplayName:()=>''};
vm.createContext(ctx);
vm.runInContext([fragment('function getGoalPrescription(', 'function parseLocalDate('),
  fragment('const focusAreaDefinitions = {','function getLegacyTargetedPreparation(')].join('\n'),ctx);

test('every supported goal, experience and frequency covers its movement slots without duplicate exercises',()=>{
  let count=0;
  for(const goal of ['hypertrophy','strength','endurance']) for(const experience of ['beginner','intermediate','advanced']) for(let days=2;days<=6;days++) {
    if(experience==='beginner'&&days>=4) continue;
    const plan=ctx.buildPlan({goal,experience,days,planRuleVersion:3,focusArea:'',focusPurpose:''},null);
    for(let day=0;day<days;day++) for(let week=0;week<4;week++) {
      const slots=ctx.movementDaySlots(plan,day), items=ctx.getWorkoutExercises(day,plan,week);
      assert.equal(items.length,slots.length,`${goal}/${experience}/${days}/${day}`);
      assert.equal(new Set(items.map(x=>x.exerciseId)).size,items.length);
      items.forEach((item,i)=>{
        const exercise=ctx.resistanceExercises.find(e=>e.id===item.exerciseId);
        assert.ok(exercise?.movementPatterns.includes(slots[i].pattern),item.name);
        if(experience==='beginner') assert.equal(exercise.level,'初级',item.name);
      });
    }
    count++;
  }
  assert.equal(count,36);
});

test('focus does not remove required movements and respects beginner eligibility',()=>{
  for(const focusArea of Object.keys(ctx.focusAreaLabels)) for(const focusPurpose of Object.keys(ctx.focusPurposeLabels)) {
    const plan=ctx.buildPlan({goal:'hypertrophy',experience:'beginner',days:3,planRuleVersion:3,focusArea,focusPurpose},null);
    for(let day=0;day<3;day++) {
      const items=ctx.getWorkoutExercises(day,plan,0);
      for(const slot of ctx.movementDaySlots(plan,day)) assert.ok(items.some(item=>ctx.resistanceExercises.find(e=>e.id===item.exerciseId)?.movementPatterns.includes(slot.pattern)));
      assert.equal(new Set(items.map(x=>x.exerciseId)).size,items.length);
      for(const item of items) assert.equal(ctx.resistanceExercises.find(e=>e.id===item.exerciseId).level,'初级');
    }
  }
});

test('novice strength uses learning-stage repetitions and rest while old plans keep legacy output',()=>{
  const input={goal:'strength',experience:'beginner',days:3,focusArea:'',focusPurpose:''};
  const current=ctx.buildPlan({...input,planRuleVersion:3},null);
  assert.equal(current.load,'根据试做组确定');
  for(const period of current.periodization) {assert.equal(period.reps,'8-12 次');assert.equal(period.rest,'2-5 分钟');}
  const old=ctx.buildPlan({...input,planRuleVersion:2},null);
  assert.equal(old.periodization[0].load,'85% 1RM');
  assert.equal(ctx.getWorkoutExercises(0,old,0)[0].name,'高脚杯深蹲');
});

test('saved movement snapshots are stable even when the library changes',()=>{
  const input={goal:'hypertrophy',experience:'intermediate',days:3,planRuleVersion:3,focusArea:'',focusPurpose:''};
  const plan=ctx.buildPlan(input,null);
  const original=ctx.getWorkoutExercises(0,plan,0);
  plan.exerciseSnapshot=[[original]];
  const backup=ctx.resistanceExercises; ctx.resistanceExercises=[];
  try { assert.deepEqual(JSON.parse(JSON.stringify(ctx.getWorkoutExercises(0,plan,0))),JSON.parse(JSON.stringify(original))); }
  finally {ctx.resistanceExercises=backup;}
});

test('new plans fail closed for unavailable power work or unresolved injury restrictions',()=>{
  const text=fragment('function saveCurrentPlan({ templateId = null','function clearPendingOfficialTemplate()');
  let profile={goal:'power',experience:'advanced',days:3}, answers={}, notice='';
  const sandbox={getProfile:()=>profile,getPlanRisk:()=>({level:'low'}),getPlanSelectionConflict:()=>'',
    getRiskAnswers:()=>answers,showPlanNotice:kind=>{notice=kind}};
  vm.createContext(sandbox);
  vm.runInContext(`${text}\nthis.save = saveCurrentPlan;`,sandbox);
  assert.equal(sandbox.save(),false); assert.equal(notice,'powerUnavailable');
  profile={...profile,goal:'strength'}; answers={qInjury:true}; notice='';
  assert.equal(sandbox.save(),false); assert.equal(notice,'unresolvedLimit');
  answers={}; profile.limits='knee pain'; notice='';
  assert.equal(sandbox.save(),false); assert.equal(notice,'unresolvedLimit');
});

test('moderate risk reduces each generated week by one set, with a one-set floor',()=>{
  const input={goal:'hypertrophy',experience:'intermediate',days:3,planRuleVersion:3,focusArea:'',focusPurpose:''};
  ctx.getPlanRisk=()=>({level:'low'});
  const low=ctx.buildPlan(input,null);
  ctx.getPlanRisk=()=>({level:'moderate'});
  try {
    const moderate=ctx.buildPlan(input,null);
    for(let i=0;i<4;i++) assert.equal(moderate.periodization[i].sets,Math.max(1,low.periodization[i].sets-1));
    assert.ok(ctx.getWorkoutExercises(0,moderate,0).length>0);
  } finally {ctx.getPlanRisk=()=>({level:'low'});}
});

test('unassessed users must confirm before any plan is saved',()=>{
  const text=fragment('function saveCurrentPlan({ templateId = null','function clearPendingOfficialTemplate()');
  let notice='', writes=0;
  const sandbox={pendingPlanSave:null,getProfile:()=>({goal:'hypertrophy',experience:'intermediate',days:3}),
    getPlanRisk:()=>({level:'unassessed'}),getPlanSelectionConflict:()=>'',getRiskAnswers:()=>({}),
    showPlanNotice:kind=>{notice=kind},localStorage:{setItem:()=>writes++}};
  vm.createContext(sandbox); vm.runInContext(`${text}\nthis.save = saveCurrentPlan;`,sandbox);
  assert.equal(sandbox.save(),false); assert.equal(notice,'riskConfirmation'); assert.equal(writes,0);
  assert.equal(sandbox.pendingPlanSave.riskConfirmed,undefined);
});

test('beginner recovery uses final exercise muscles, including replacements and deferrals',()=>{
  const text=fragment('function getResolvedPlanSchedule(', 'function getPlanDayDate(');
  let replacement=false, defer=false;
  const addDays=(date,n)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
  const sandbox={addDays,loadPlanAdjustments:()=>({pauses:[],overrides:defer?{'0-0':{deferTo:'2026-10-06'}}:{}}),
    planDayId:(_p,_l,w,d)=>`${w}-${d}`,getBasePlanDayDate:(_s,w,d)=>addDays('2026-10-05',w*7+d),
    getWorkoutExercises:(d)=>[{exerciseId:d?'back':'chest'}],
    applyPlanExerciseReplacements:(id,items)=>replacement&&id==='0-1'?[{exerciseId:'chest'}]:items,
    ensureUniqueWorkoutExercises:items=>items,getWorkoutLibraryExercise:item=>({primaryMuscles:[item.exerciseId]})};
  vm.createContext(sandbox);vm.runInContext(`${text}\nthis.schedule=getResolvedPlanSchedule;`,sandbox);
  const profile={experience:'beginner'},plan={ruleVersion:3,days:2,split:[[],[]]};
  assert.equal(sandbox.schedule(profile,plan,'2026-10-05')[1].date,'2026-10-06');
  replacement=true;assert.equal(sandbox.schedule(profile,plan,'2026-10-05')[1].date,'2026-10-07');
  defer=true;assert.equal(sandbox.schedule(profile,plan,'2026-10-05')[1].date,'2026-10-08');
  assert.equal(sandbox.schedule({experience:'intermediate'},plan,'2026-10-05')[1].date,'2026-10-07');
});

test('weekly planned muscle coverage counts sets once per side and applies replacements',()=>{
  const text=fragment('function getPlanMuscleCoverage(', 'function renderPlanMuscleCoverage(');
  const catalog={lunge:{primaryMuscles:['股四头肌','臀肌']},row:{primaryMuscles:['中背部']},curl:{primaryMuscles:['肱二头肌']}};
  const sandbox={getWorkoutExercises:(d)=>d===0?[{exerciseId:'lunge',sets:3},{exerciseId:'row',sets:2}]:[{exerciseId:'row',sets:4}],
    applyPlanExerciseReplacements:(id,items)=>id==='second'?[{exerciseId:'curl',sets:4}]:items,
    ensureUniqueWorkoutExercises:items=>items,getWorkoutLibraryExercise:item=>catalog[item.exerciseId],
    getExerciseSetCount:item=>item.sets};
  vm.createContext(sandbox);vm.runInContext(`${text}\nthis.coverage=getPlanMuscleCoverage;`,sandbox);
  const schedule=[{weekIndex:0,dayIndex:0,id:'first'},{weekIndex:0,dayIndex:1,id:'second'}];
  const result=sandbox.coverage({split:[[],[]]},0,schedule);
  assert.equal(result.counts.get('股四头肌'),3);assert.equal(result.counts.get('臀肌'),3);
  assert.equal(result.counts.get('中背部'),2);assert.equal(result.counts.get('肱二头肌'),4);
  schedule[1].skipped=true;assert.equal(sandbox.coverage({split:[[],[]]},0,schedule).counts.has('肱二头肌'),false);
  assert.match(source, /<option value="power" disabled>🔒/);
});
