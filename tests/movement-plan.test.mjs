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

test('v10 uses goal and experience volume ranges with reduced moderate risk targets',()=>{
  const ranges={hypertrophy:{beginner:[8,10],intermediate:[10,16],advanced:[12,20]},strength:{beginner:[6,8],intermediate:[8,12],advanced:[10,16]},endurance:{beginner:[6,8],intermediate:[8,12],advanced:[10,14]}};
  for(const [goal,levels] of Object.entries(ranges)) for(const [experience,[min,max]] of Object.entries(levels)) for(const risk of ['low','moderate']) {
    const plan=ctx.buildPlan({goal,experience,days:4,planRuleVersion:10,focusArea:''},null);
    plan.risk={level:risk};
    const targets=plan.periodization.map((_,week)=>ctx.getWeeklyMuscleTarget(plan,week));
    const offset=risk==='moderate'?2:0;
    assert.ok(targets.every(n=>n>=min-offset && n<=max-offset));
    assert.ok(targets[0]<=targets[1] && targets[1]<=targets[2] && targets[3]<=targets[1]);
    assert.equal(ctx.getWeeklyLargeMuscleFloor(plan),min-offset);
  }
});

test('v10 and v11 generate balanced volumes within limits and preserve the daily muscle cap',()=>{
  for(const version of [10,11]) for(const goal of ['hypertrophy','strength','endurance']) for(const experience of ['beginner','intermediate','advanced']) for(const days of [2,3,4,6]) {
    if(experience==='beginner' && days>3) continue;
    for(const risk of ['low','moderate']) {
      const plan=ctx.buildPlan({goal,experience,days,planRuleVersion:version,focusArea:''},null);
      plan.risk={level:risk}; plan.exerciseSnapshot=[];
      for(let week=0;week<4;week++) {
        const generated=plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week));
        const allocated=ctx.allocateWeeklyMuscleVolume(plan,week,generated);
        const audit=ctx.auditWeeklyMuscleVolume(plan,week,allocated);
        const upper=ctx.getWeeklyMajorMuscleRange(plan)[1];
        assert.ok(Object.values(audit.counts).every(n=>n<=upper),`${goal}/${experience}/${days}/${risk}/${week}: ${JSON.stringify(audit)}`);
        for(const day of allocated) {
          const counts={};
          for(const item of day) for(const group of ctx.getLargeMuscleGroups(library.find(e=>e.id===item.exerciseId)?.primaryMuscles)) counts[group]=(counts[group]||0)+item.sets;
          assert.ok(Object.values(counts).every(n=>n<=(risk==='moderate'?7:10)),`${goal}/${experience}/${days}/${risk}/${week}: ${JSON.stringify(counts)}`);
        }
        plan.exerciseSnapshot.push(allocated);
      }
    }
  }
});

test('v10 keeps the daily limit when an advanced three-day split cannot reach the weekly floor',()=>{
  const plan=ctx.buildPlan({goal:'hypertrophy',experience:'advanced',days:3,planRuleVersion:10,focusArea:''},null);
  const generated=plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,0));
  const audit=ctx.auditWeeklyMuscleVolume(plan,0,ctx.allocateWeeklyMuscleVolume(plan,0,generated));
  assert.equal(audit.minimum,12);
  assert.ok(audit.counts['腿部']<=10);
  assert.ok(audit.belowMinimum.includes('腿部'));
});

test('v11 push pull legs assigns deadlifts to pull and knee and hip work to legs',()=>{
  for(const goal of ['hypertrophy','strength','endurance']) for(const [experience,days] of [['advanced',3],['intermediate',5],['advanced',6]]) {
    const plan=ctx.buildPlan({goal,experience,days,planRuleVersion:11,focusArea:''},null);
    plan.exerciseSnapshot=[];
    assert.match(plan.split[1][0],/背部与臀腿后侧/);
    for(let week=0;week<4;week++) {
      const generated=plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week));
      for(let day=0;day<days;day++) {
        const items=generated[day].map(item=>library.find(e=>e.id===item.exerciseId));
        assert.ok(items.length && items.every(Boolean));
        if(day%3===1) assert.ok(items.some(e=>e.movementPatterns.includes('hip_hinge') && e.nameZh.includes('硬拉') && e.primaryMuscles.includes('腘绳肌')));
        if(day%3===2) for(const pattern of ['squat','hip_thrust_bridge','knee_flexion']) assert.ok(items.some(e=>e.movementPatterns.includes(pattern)),pattern);
      }
      const allocated=ctx.allocateWeeklyMuscleVolume(plan,week,generated);
      if(goal==='hypertrophy' && experience==='advanced' && days===3 && week===0) assert.ok(ctx.auditWeeklyMuscleVolume(plan,week,allocated).counts['腿部']>=12);
      plan.exerciseSnapshot.push(allocated);
    }
  }
});

test('deadlift sets count once toward both glutes and legs in weekly plan volume',()=>{
  const plan=ctx.buildPlan({goal:'hypertrophy',experience:'advanced',days:3,planRuleVersion:11,focusArea:''},null);
  for(const id of ['romanian-deadlift','sumo-deadlift','kettlebell-one-legged-deadlift','smith-machine-stiff-legged-deadlift']) {
    const counts=ctx.auditWeeklyMuscleVolume(plan,0,[[{exerciseId:id,sets:3}]]).counts;
    assert.equal(counts['臀部'],3,id);assert.equal(counts['腿部'],3,id);
  }
});

test('v9 plans use risk-adjusted floors and cap weekly major-muscle sets',()=>{
  for(const goal of ['hypertrophy','strength','endurance']) for(const experience of ['beginner','intermediate','advanced']) for(let days=2;days<=6;days++) {
    if(experience==='beginner' && days>3) continue;
    for(const risk of ['low','moderate']) for(const focusArea of ['', 'glutes']) {
      const plan=ctx.buildPlan({goal,experience,days,planRuleVersion:9,focusArea,focusPurpose:focusArea?'hypertrophy':''},null);
      plan.risk={level:risk}; plan.exerciseSnapshot=[];
      const targets=plan.periodization.map((_,week)=>ctx.getWeeklyMuscleTarget(plan,week));
      assert.ok(targets[0] <= targets[1] && targets[1] <= targets[2] && targets[3] < targets[2]);
      for(let week=0;week<4;week++) {
        const generated=plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week));
        assert.ok(generated.every(day=>day.length));
        const allocated=ctx.allocateWeeklyMuscleVolume(plan,week,generated);
        const audit=ctx.auditWeeklyMuscleVolume(plan,week,allocated);
        assert.equal(audit.minimum,risk==='moderate'?4:6);
        assert.deepEqual(Array.from(audit.belowMinimum),[],`${goal}/${experience}/${days}/${risk}/${focusArea}/${week}: ${JSON.stringify(audit)}`);
        assert.ok(Object.values(audit.counts).every(count=>count<=20),JSON.stringify(audit));
        plan.exerciseSnapshot.push(allocated);
      }
    }
  }
});

test('v9 weekly cap also reduces initial exercises that count for multiple groups',()=>{
  const original=ctx.resistanceExercises;
  const items=Array.from({length:8},(_,i)=>({id:`fixture-${i}`,nameZh:`fixture ${i}`,libraryType:'resistance',category:'臀部',primaryMuscles:['臀肌','股四头肌'],movementPatterns:['hip_hinge'],level:'初级',mechanic:'复合动作',roles:['main']}));
  ctx.resistanceExercises=items;
  try {
    const plan={ruleVersion:9,days:4,experience:'intermediate',goal:'hypertrophy',risk:{level:'low'},periodization:[{reps:'8-12 次',rest:'90 秒'}],focusArea:'',selectionFavoriteIds:[]};
    const days=Array.from({length:4},(_,day)=>items.slice(day*2,day*2+2).map(x=>({exerciseId:x.id,name:x.nameZh,prescription:'3 组 × 8-12 次'})));
    const result=ctx.allocateWeeklyMuscleVolume(plan,0,days);
    const counts=ctx.auditWeeklyMuscleVolume(plan,0,result).counts;
    assert.equal(counts['臀部'],20);assert.equal(counts['腿部'],20);
    assert.ok(result.flat().every(x=>x.sets>=1));
  } finally {ctx.resistanceExercises=original;}
});

test('two-day and beginner plans cover large muscle groups with bounded full-body sessions',()=>{
  for(const goal of ['hypertrophy','strength','endurance']) for(const experience of ['beginner','intermediate','advanced']) for(const days of [2,3]) {
    if(days===3 && experience!=='beginner') continue;
    for(const risk of ['low','moderate']) for(const focusArea of ['', ...Object.keys(ctx.focusAreaLabels)]) {
      const plan=ctx.buildPlan({goal,experience,days,planRuleVersion:8,focusArea,focusPurpose:focusArea?'hypertrophy':''},null);
      plan.risk={level:risk};plan.exerciseSnapshot=[];
      for(let week=0;week<4;week++) {
        const generated=plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week));
        assert.ok(generated.every(day=>day.length>=5 && day.length<=6),`${goal}/${experience}/${days}/${risk}/${focusArea}/${week} generated ${generated.map(d=>d.length)}`);
        const allocated=ctx.allocateWeeklyMuscleVolume(plan,week,generated);
        const audit=ctx.auditWeeklyMuscleVolume(plan,week,allocated);
        assert.deepEqual(Array.from(audit.belowMinimum),[],`${goal}/${experience}/${days}/${risk}/${focusArea}/${week}: ${JSON.stringify(audit)}`);
        for(const day of allocated) {
          assert.ok(day.length<=6);
          assert.ok(day.reduce((n,item)=>n+item.sets,0)<=(risk==='moderate'?[14,16,18,12][week]:18));
        }
        plan.exerciseSnapshot.push(allocated);
      }
    }
  }
});

test('all current plan structures meet the major muscle weekly floor',()=>{
  for(const goal of ['hypertrophy','strength','endurance']) for(const experience of ['intermediate','advanced']) for(let days=3;days<=6;days++) {
    for(const risk of ['low','moderate']) for(const focusArea of ['',...Object.keys(ctx.focusAreaLabels)]) {
      const plan=ctx.buildPlan({goal,experience,days,planRuleVersion:8,focusArea,focusPurpose:focusArea?'hypertrophy':''},null);
      plan.risk={level:risk};plan.exerciseSnapshot=[];
      for(let week=0;week<4;week++) {
        const generated=plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week));
        const allocated=ctx.allocateWeeklyMuscleVolume(plan,week,generated);
        const audit=ctx.auditWeeklyMuscleVolume(plan,week,allocated);
        assert.deepEqual(Array.from(audit.belowMinimum),[],`${goal}/${experience}/${days}/${risk}/${focusArea}/${week}: ${JSON.stringify(audit)}`);
        plan.exerciseSnapshot.push(allocated);
      }
    }
  }
});

test('every supported goal, experience and frequency covers its movement slots without duplicate exercises',()=>{
  let count=0;
  for(const goal of ['hypertrophy','strength','endurance']) for(const experience of ['beginner','intermediate','advanced']) for(let days=2;days<=6;days++) {
    if(experience==='beginner'&&days>=4) continue;
    const plan=ctx.buildPlan({goal,experience,days,planRuleVersion:3,focusArea:'',focusPurpose:''},null);
    for(let day=0;day<days;day++) for(let week=0;week<4;week++) {
      const slots=ctx.movementDaySlots(plan,day), items=ctx.getWorkoutExercises(day,plan,week);
      assert.equal(items.length,slots.length,`${goal}/${experience}/${days}/${day}`);
      assert.equal(new Set(items.map(x=>x.exerciseId)).size,items.length);
      items.forEach((item)=>{
        const exercise=ctx.resistanceExercises.find(e=>e.id===item.exerciseId);
        assert.ok(slots.some(slot=>exercise?.movementPatterns.includes(slot.pattern) && (!slot.category || exercise.category===slot.category)),item.name);
        if(experience==='beginner') assert.equal(exercise.level,'初级',item.name);
      });
      for(const slot of slots) assert.ok(items.some(item=>{const exercise=ctx.resistanceExercises.find(e=>e.id===item.exerciseId);return exercise?.movementPatterns.includes(slot.pattern)&&(!slot.category||exercise.category===slot.category)}),slot.pattern);
    }
    count++;
  }
  assert.equal(count,36);
});

test('beginner selection uses level and equipment preference without a fixed exclusion list',()=>{
  const novice={experience:'beginner'};
  for(const id of ['pullups','chin-up','bench-dips','inverted-row','barbell-bench-press','barbell-incline-bench-press','decline-barbell-bench-press','close-grip-barbell-bench-press','smith-machine-stiff-legged-deadlift']) {
    const exercise=ctx.resistanceExercises.find(item=>item.id===id);
    assert.ok(exercise,id);assert.equal(ctx.movementCandidateAllowed(exercise,novice),exercise.level==='初级',id);
  }
  assert.equal(ctx.movementCandidateAllowed({level:'中级'},novice),false);
});

test('new workout ordering keeps compound exercises first and alternates available push and pull within each group',()=>{
  const original=ctx.resistanceExercises;
  ctx.resistanceExercises=[
    {id:'push-a',mechanic:'复合动作',movementFamily:'upper_push'},
    {id:'push-b',mechanic:'复合动作',movementFamily:'lower_push'},
    {id:'pull-a',mechanic:'复合动作',movementFamily:'upper_pull'},
    {id:'aux-push',mechanic:'孤立动作',movementFamily:'upper_push'},
    {id:'aux-pull',mechanic:'孤立动作',movementFamily:'upper_pull'},
    {id:'core',mechanic:'孤立动作',movementFamily:'core'},
    {id:'face-pull',mechanic:'复合动作',movementFamily:'upper_pull',roles:['accessory']}
  ];
  try {
    const input=['push-a','aux-push','push-b','pull-a','core','aux-pull','face-pull'].map(exerciseId=>({exerciseId}));
    assert.deepEqual(Array.from(ctx.orderMovementWorkout(input),x=>x.exerciseId),['push-a','pull-a','push-b','aux-push','aux-pull','core','face-pull']);
    assert.deepEqual(input.map(x=>x.exerciseId),['push-a','aux-push','push-b','pull-a','core','aux-pull','face-pull']);
  } finally {ctx.resistanceExercises=original;}
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

test('four-week snapshots retain two main exercises and rotate one or two eligible accessories',()=>{
  for(const experience of ['beginner','intermediate','advanced']) {
    const days=experience==='advanced'?4:3;
    const plan=ctx.buildPlan({goal:'hypertrophy',experience,days,planRuleVersion:3,focusArea:'',focusPurpose:''},null);
    plan.selectionFavoriteIds=[];plan.exerciseSnapshot=[];
    for(let week=0;week<4;week++) plan.exerciseSnapshot.push(plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week)));
    for(let week=1;week<4;week++) for(let day=0;day<days;day++) {
      const previous=plan.exerciseSnapshot[week-1][day], current=plan.exerciseSnapshot[week][day];
      const prevIds=new Set(previous.map(item=>item.exerciseId));
      const nowIds=new Set(current.map(item=>item.exerciseId));
      const removed=previous.filter(item=>!nowIds.has(item.exerciseId));
      const added=current.filter(item=>!prevIds.has(item.exerciseId));
      assert.equal(removed.length,added.length,`${experience} week ${week} day ${day}`);
      assert.ok(removed.length<=2,`${experience} week ${week} day ${day}`);
      const main=previous.filter(item=>ctx.isMainMovementExercise(ctx.resistanceExercises.find(e=>e.id===item.exerciseId))).slice(0,2);
      for(const item of main) assert.ok(nowIds.has(item.exerciseId),item.name);
      for(const item of removed) assert.ok(ctx.isAccessoryMovementExercise(ctx.resistanceExercises.find(e=>e.id===item.exerciseId)),item.name);
      for(const item of added) assert.ok(ctx.isAccessoryMovementExercise(ctx.resistanceExercises.find(e=>e.id===item.exerciseId)),item.name);
      assert.equal(nowIds.size,current.length);
    }
    for(let day=0;day<days;day++) assert.notDeepEqual(Array.from(plan.exerciseSnapshot[0][day],x=>x.exerciseId),Array.from(plan.exerciseSnapshot[1][day],x=>x.exerciseId));
  }
});

test('favorites are preferred only after pattern and beginner level checks; snapshots do not change',()=>{
  const profile={goal:'hypertrophy',experience:'beginner',days:3,planRuleVersion:3,focusArea:'',focusPurpose:''};
  const plan=ctx.buildPlan(profile,null);
  plan.selectionFavoriteIds=['barbell-bench-press','power-clean'];plan.exerciseSnapshot=[];
  plan.exerciseSnapshot.push(plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,0)));
  const first=plan.exerciseSnapshot[0][0];
  assert.ok(first.some(item=>item.exerciseId==='barbell-bench-press'));
  assert.ok(first.every(item=>item.exerciseId!=='power-clean'));
  const saved=JSON.stringify(first);
  plan.selectionFavoriteIds=[];
  assert.equal(JSON.stringify(ctx.getWorkoutExercises(0,plan,0)),saved);
  assert.equal(ctx.getWeeklyMuscleTarget({...plan,weeklyVolumeTargets:[11,15,19,7],risk:{level:'moderate'}},0),11);
});

test('focus bonus remains stable while weekly rotations preserve required patterns',()=>{
  for(const focusArea of Object.keys(ctx.focusAreaLabels)) for(const focusPurpose of Object.keys(ctx.focusPurposeLabels)) {
    const plan=ctx.buildPlan({goal:'hypertrophy',experience:'beginner',days:3,planRuleVersion:3,focusArea,focusPurpose},null);
    plan.exerciseSnapshot=[];
    for(let week=0;week<4;week++) plan.exerciseSnapshot.push(plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week)));
    for(let week=1;week<4;week++) for(let day=0;day<3;day++) {
      const previous=plan.exerciseSnapshot[week-1][day], current=plan.exerciseSnapshot[week][day];
      const ids=new Set(current.map(item=>item.exerciseId));
      assert.equal(ids.size,current.length,`${focusArea}/${focusPurpose}/${week}/${day}`);
      assert.ok(previous.filter(item=>!ids.has(item.exerciseId)).length<=2,`${focusArea}/${focusPurpose}/${week}/${day}`);
      for(const bonus of previous.filter(item=>item.isFocusBonus)) assert.ok(ids.has(bonus.exerciseId),`${focusArea}/${focusPurpose}/${week}/${day}`);
      for(const slot of ctx.movementDaySlots(plan,day)) assert.ok(current.some(item=>{const e=ctx.resistanceExercises.find(x=>x.id===item.exerciseId);return e?.movementPatterns.includes(slot.pattern)&&(!slot.category||e.category===slot.category)}));
    }
  }
});

test('weekly volume allocation respects session and muscle limits across supported plans',()=>{
  for(const goal of ['hypertrophy','strength','endurance']) for(const experience of ['beginner','intermediate','advanced']) for(let days=2;days<=6;days++) {
    if(experience==='beginner'&&days>=4) continue;
    const plan=ctx.buildPlan({goal,experience,days,planRuleVersion:4,focusArea:'glutes',focusPurpose:'hypertrophy'},null);
    plan.exerciseSnapshot=[];
    for(let week=0;week<4;week++) {
      const generated=plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week));
      const allocated=ctx.allocateWeeklyMuscleVolume(plan,week,generated);
      const maxByWeek=experience==='beginner'?[16,17,18,14]:experience==='advanced'?[20,22,24,16]:[18,21,24,16];
      for(const items of allocated) {
        assert.ok(items.reduce((n,item)=>n+item.sets,0)<=maxByWeek[week],`${goal}/${experience}/${days}/${week}`);
        const counts={};
        for(const item of items) for(const muscle of ctx.resistanceExercises.find(e=>e.id===item.exerciseId).primaryMuscles) counts[muscle]=(counts[muscle]||0)+item.sets;
        assert.ok(Object.values(counts).every(n=>n<=10),JSON.stringify(counts));
        assert.equal(new Set(items.map(x=>x.exerciseId)).size,items.length);
      }
      plan.exerciseSnapshot.push(allocated);
    }
  }
});

test('moderate-risk allocations use lower limits and do not alter already saved snapshots',()=>{
  const plan=ctx.buildPlan({goal:'hypertrophy',experience:'intermediate',days:4,planRuleVersion:4,focusArea:'',focusPurpose:''},null);
  plan.risk={level:'moderate'};plan.exerciseSnapshot=[];
  for(let week=0;week<4;week++) {
    const snapshot=ctx.allocateWeeklyMuscleVolume(plan,week,plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week)));
    for(const items of snapshot) {
      assert.ok(items.reduce((n,x)=>n+x.sets,0)<=[14,16,18,12][week]);
      const counts={};for(const x of items) for(const m of ctx.resistanceExercises.find(e=>e.id===x.exerciseId).primaryMuscles) counts[m]=(counts[m]||0)+x.sets;
      assert.ok(Object.values(counts).every(n=>n<=7));
    }
    plan.exerciseSnapshot.push(snapshot);
  }
  const saved=JSON.stringify(plan.exerciseSnapshot[0][0]);
  plan.selectionFavoriteIds=['barbell-bench-press'];
  assert.equal(JSON.stringify(ctx.getWorkoutExercises(0,plan,0)),saved);
});

test('volume supplementation keeps core movement patterns and protects main exercises from weekly rotation',()=>{
  const plan=ctx.buildPlan({goal:'hypertrophy',experience:'intermediate',days:4,planRuleVersion:4,focusArea:'glutes',focusPurpose:'hypertrophy'},null);
  plan.exerciseSnapshot=[];
  for(let week=0;week<4;week++) {
    const generated=plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week));
    const result=ctx.allocateWeeklyMuscleVolume(plan,week,generated);
    for(let day=0;day<plan.days;day++) {
      for(const pattern of ctx.movementDaySlots(plan,day)) assert.ok(result[day].some(item=>{const e=ctx.resistanceExercises.find(e=>e.id===item.exerciseId);return e.movementPatterns.includes(pattern.pattern)&&(!pattern.category||e.category===pattern.category)}));
      if(week) {
        const previous=plan.exerciseSnapshot[week-1][day].filter(x=>!x.isFocusBonus).filter(x=>ctx.isMainMovementExercise(ctx.resistanceExercises.find(e=>e.id===x.exerciseId))).slice(0,2);
        for(const item of previous) assert.ok(result[day].some(x=>x.exerciseId===item.exerciseId),item.name);
        const currentIds=new Set(result[day].map(x=>x.exerciseId));
        assert.ok(plan.exerciseSnapshot[week-1][day].filter(x=>!currentIds.has(x.exerciseId)).length<=2);
      }
    }
    plan.exerciseSnapshot.push(result);
  }
});

test('hip focus receives distributed direct sets and moderate risk reduces targets',()=>{
  const plan=ctx.buildPlan({goal:'hypertrophy',experience:'advanced',days:4,planRuleVersion:11,focusArea:'glutes',focusPurpose:'hypertrophy'},null);
  const before=plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,0));
  const result=ctx.allocateWeeklyMuscleVolume(plan,0,before);
  const perDay=result.map(items=>items.reduce((n,item)=>n+(ctx.resistanceExercises.find(e=>e.id===item.exerciseId).primaryMuscles.includes('臀肌')?item.sets:0),0));
  assert.ok(perDay.filter(Boolean).length>=2,JSON.stringify(perDay));
  assert.ok(perDay.reduce((a,b)=>a+b,0)>=10,JSON.stringify(result));
  assert.equal(ctx.getWeeklyMuscleTarget({...plan,risk:{level:'moderate'}},0),10);
});

test('rotation preserves an exercise and records when its movement pattern has no alternative',()=>{
  const plan=ctx.buildPlan({goal:'hypertrophy',experience:'advanced',days:3,planRuleVersion:3,focusArea:'',focusPurpose:''},null);
  plan.exerciseSnapshot=[];plan.exerciseSnapshot.push(plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,0)));
  const initial=plan.exerciseSnapshot[0][0];
  const target=initial.find(item=>ctx.resistanceExercises.find(e=>e.id===item.exerciseId)?.movementPatterns.includes('shoulder_horizontal_adduction'));
  const saved=ctx.resistanceExercises;
  ctx.resistanceExercises=saved.filter(item=>!item.movementPatterns.includes('shoulder_horizontal_adduction') || item.id===target.exerciseId);
  try {
    const next=ctx.getWorkoutExercises(0,plan,1);
    assert.equal(next.find(item=>item.exerciseId===target.exerciseId)?.variationUnavailable,true);
  } finally {ctx.resistanceExercises=saved;}
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
  const catalog={lunge:{primaryMuscles:['股四头肌','腘绳肌','臀肌']},row:{primaryMuscles:['中背部','背阔肌']},curl:{primaryMuscles:['肱二头肌','肱三头肌']}};
  const sandbox={getWorkoutExercises:(d)=>d===0?[{exerciseId:'lunge',sets:3},{exerciseId:'row',sets:2}]:[{exerciseId:'row',sets:4}],
    applyPlanExerciseReplacements:(id,items)=>id==='second'?[{exerciseId:'curl',sets:4}]:items,
    ensureUniqueWorkoutExercises:items=>items,getWorkoutLibraryExercise:item=>catalog[item.exerciseId],
    getExerciseSetCount:item=>item.sets};
  vm.createContext(sandbox);vm.runInContext(`${text}\nthis.coverage=getPlanMuscleCoverage;`,sandbox);
  const schedule=[{weekIndex:0,dayIndex:0,id:'first'},{weekIndex:0,dayIndex:1,id:'second'}];
  const result=sandbox.coverage({split:[[],[]]},0,schedule);
  assert.equal(result.counts.get('腿部'),3);assert.equal(result.counts.get('臀部'),3);
  assert.equal(result.counts.get('背部'),2);assert.equal(result.counts.get('手臂'),4);
  schedule[1].skipped=true;assert.equal(sandbox.coverage({split:[[],[]]},0,schedule).counts.has('手臂'),false);
  assert.match(source, /<option value="power" disabled>爆发力[^<]*🔒/);
});

test('weekly muscle coverage omits zero-set muscles and empty regions',()=>{
  const text=fragment('function renderPlanMuscleCoverage(', 'function renderPlan()');
  const element={innerHTML:''};
  const sandbox={document:{querySelector:()=>element},getPlanMuscleCoverage:()=>({counts:new Map([['胸部',3]]),unknown:0}),
    appLanguage:'zh',escapeLogText:s=>s,translateInterfaceText:s=>s};
  vm.createContext(sandbox);vm.runInContext(`${text}\nthis.render=renderPlanMuscleCoverage;`,sandbox);
  sandbox.render({},0,[]);
  assert.match(element.innerHTML,/当周肌群覆盖/);
  assert.match(element.innerHTML,/胸部/);assert.match(element.innerHTML,/3 组/);
  assert.doesNotMatch(element.innerHTML,/0 组|髋外展肌群|<h4>下肢<\/h4>/);
  sandbox.getPlanMuscleCoverage=()=>({counts:new Map([['背部',4],['腿部',5],['核心',2]]),unknown:0});
  sandbox.render({},0,[]);
  assert.match(element.innerHTML,/is-upper"><h4>上肢/);
  assert.match(element.innerHTML,/is-lower"><h4>下肢/);
  assert.match(element.innerHTML,/is-core"><h4>核心/);
  assert.match(source,/\.plan-muscle-group\.is-lower \.plan-muscle-item strong \{ color: var\(--brand-accent\);/);
  sandbox.getPlanMuscleCoverage=()=>({counts:new Map(),unknown:0});sandbox.render({},0,[]);
  assert.match(element.innerHTML,/本周暂无计划肌群数据/);
});

test('volume guidance avoids unmet target warnings and pending advice text',()=>{
  const text=fragment('function renderPlanMuscleCoverage(', 'function renderPlan()');
  const element={innerHTML:''};
  const sandbox={document:{querySelector:()=>element},getPlanMuscleCoverage:()=>({counts:new Map([['胸部',4]]),unknown:0}),
    getWeeklyMuscleTarget:()=>10,getPlanTargetMuscles:()=>['胸部','臀肌'],getFocusTargetMuscles:()=>['臀肌'],
    getWorkoutExercises:()=>[{sets:4}],applyPlanExerciseReplacements:(_,items)=>items,ensureUniqueWorkoutExercises:items=>items,getExerciseSetCount:item=>item.sets,
    appLanguage:'zh',escapeLogText:s=>s,translateInterfaceText:s=>s};
  vm.createContext(sandbox);vm.runInContext(`${text}\nthis.render=renderPlanMuscleCoverage;`,sandbox);
  sandbox.render({ruleVersion:4,risk:{level:'low'},focusArea:'glutes',split:[[]]},0,[{weekIndex:0,dayIndex:0,id:'a'}]);
  assert.doesNotMatch(element.innerHTML,/未达到目标|少于 16 组/);
  assert.doesNotMatch(element.innerHTML,/同一肌群可从 1–2 个动作开始|one or two exercises for a muscle group/);
  assert.doesNotMatch(element.innerHTML,/臀肌<\/span><strong>0/);
});

test('three-day hypertrophy uses full-body sessions with conservative weekly targets',()=>{
  for(const experience of ['beginner','intermediate','advanced']) {
    const plan=ctx.buildPlan({goal:'hypertrophy',experience,days:3,planRuleVersion:4,focusArea:'',focusPurpose:''},null);
    assert.equal(plan.split.length,3);
    assert.ok(plan.split.every(day=>day[0].includes('全身训练')));
    plan.exerciseSnapshot=[];
    for(let week=0;week<4;week++) {
      assert.equal(ctx.getWeeklyMuscleTarget(plan,week),[6,7,9,6][week]);
      const generated=plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week));
      const result=ctx.allocateWeeklyMuscleVolume(plan,week,generated);
      for(let day=0;day<3;day++) {
        const patterns=ctx.movementDaySlots(plan,day).map(x=>x.pattern);
        assert.deepEqual(Array.from(patterns),['squat','hip_hinge','horizontal_push','horizontal_pull',['shoulder_abduction','elbow_flexion','elbow_extension'][day],'trunk_anti_rotation']);
        assert.ok(result[day].length<=6);
        assert.ok(result[day].reduce((total,item)=>total+item.sets,0)<=[11,12,14,11][week]);
      }
      plan.exerciseSnapshot.push(result);
    }
  }
});

test('new three-day hypertrophy plans use the agreed minimum and record actual muscle coverage',()=>{
  for(const experience of ['beginner','intermediate','advanced']) for(const risk of ['low','moderate']) {
    const plan=ctx.buildPlan({goal:'hypertrophy',experience,days:3,planRuleVersion:7,focusArea:'',focusPurpose:''},null);
    plan.risk={level:risk}; plan.exerciseSnapshot=[];
    const minimum=risk==='moderate'?5:8;
    for(let week=0;week<4;week++) {
      assert.equal(ctx.getWeeklyMuscleTarget(plan,week),minimum);
      const days=ctx.allocateWeeklyMuscleVolume(plan,week,plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week)));
      const audit=ctx.auditWeeklyMuscleVolume(plan,week,days);
      assert.equal(audit.minimum,minimum);
      assert.deepEqual(Object.keys(audit.counts),['胸部','背部','臀部','腿部']);
      for(const [muscle,count] of Object.entries(audit.counts)) {
        const expected=days.flat().reduce((sum,item)=>sum+(ctx.getLargeMuscleGroups(ctx.resistanceExercises.find(e=>e.id===item.exerciseId).primaryMuscles).includes(muscle)?item.sets:0),0);
        assert.equal(count,expected,`${experience}/${risk}/${week}/${muscle}`);
        assert.equal(audit.belowMinimum.includes(muscle),count<minimum);
      }
      const caps=risk==='moderate'?[14,16,18,12]:experience==='beginner'?[16,17,18,14]:experience==='advanced'?[20,22,24,16]:[18,21,24,16];
      for(const day of days) assert.ok(day.reduce((sum,item)=>sum+item.sets,0)<=caps[week]);
      const allPatterns=days.flat().flatMap(item=>ctx.resistanceExercises.find(e=>e.id===item.exerciseId).movementPatterns);
      assert.ok(allPatterns.includes('squat') && allPatterns.includes('hip_hinge'));
      plan.exerciseSnapshot.push(days);
    }
  }
});

test('large-group accounting counts an exercise once per group and ignores arm isolation',()=>{
  assert.deepEqual(Array.from(ctx.getLargeMuscleGroups(['背阔肌','中背部','肱二头肌'])),['背部']);
  assert.deepEqual(Array.from(ctx.getLargeMuscleGroups(['臀肌','股四头肌','腘绳肌'])),['臀部','腿部']);
  assert.deepEqual(Array.from(ctx.getLargeMuscleGroups(['肱三头肌'])),[]);
});

test('saved v6 three-day hypertrophy plans retain their original minimum schedule',()=>{
  const plan=ctx.buildPlan({goal:'hypertrophy',experience:'intermediate',days:3,planRuleVersion:6,focusArea:'',focusPurpose:''},null);
  assert.deepEqual([0,1,2,3].map(week=>ctx.getWeeklyMuscleTarget(plan,week)),[6,7,9,6]);
});

test('new three-day plans use full body for beginner and intermediate and push-pull-legs for advanced',()=>{
  for(const goal of ['hypertrophy','strength','endurance']) for(const experience of ['beginner','intermediate','advanced']) {
    const plan=ctx.buildPlan({goal,experience,days:3,planRuleVersion:6,focusArea:'',focusPurpose:''},null);
    if(experience==='advanced') assert.deepEqual(Array.from(plan.split,day=>day[0]),['上肢推训练','上肢拉训练','下肢膝髋训练']);
    else assert.ok(plan.split.every(day=>day[0].includes('全身训练')));
    plan.exerciseSnapshot=[];
    for(let week=0;week<4;week++) {
      const generated=plan.split.map((_,day)=>ctx.getWorkoutExercises(day,plan,week));
      assert.ok(generated.every(day=>day.length>0),`${goal}/${experience}/${week}`);
      const allocated=ctx.allocateWeeklyMuscleVolume(plan,week,generated);
      for(let day=0;day<3;day++) for(const slot of ctx.movementDaySlots(plan,day)) {
        assert.ok(allocated[day].some(item=>{const e=ctx.resistanceExercises.find(e=>e.id===item.exerciseId);return e?.movementPatterns.includes(slot.pattern)&&(!slot.category||e.category===slot.category)}),`${goal}/${experience}/${day}/${slot.pattern}`);
      }
      if(goal==='hypertrophy') assert.equal(ctx.getWeeklyMuscleTarget(plan,week),[6,7,9,6][week]);
      plan.exerciseSnapshot.push(allocated);
    }
  }
});

test('v6 base movement patterns and choices do not depend on training goal',()=>{
  for(const experience of ['beginner','intermediate','advanced']) for(const days of [2,3,4,5,6]) {
    if(experience==='beginner' && days>4) continue;
    const plans=['hypertrophy','strength','endurance'].map(goal=>ctx.buildPlan({goal,experience,days,planRuleVersion:6,focusArea:'',focusPurpose:''},null));
    for(let day=0;day<plans[0].days;day++) {
      const slots=plans.map(plan=>JSON.stringify(ctx.movementDaySlots(plan,day)));
      const exercises=plans.map(plan=>JSON.stringify(ctx.selectMovementDay(plan,day).map(item=>item?.id)));
      assert.equal(new Set(slots).size,1,`${experience}/${days}/${day} patterns`);
      assert.equal(new Set(exercises).size,1,`${experience}/${days}/${day} exercises`);
    }
  }
  for(const goal of ['hypertrophy','strength','endurance']) {
    const plan=ctx.buildPlan({goal,experience:'intermediate',days:3,planRuleVersion:6,focusArea:'glutes',focusPurpose:''},null);
    assert.equal(plan.focusPurpose,'hypertrophy');
    assert.deepEqual(Array.from([0,1,2],day=>ctx.movementDaySlots(plan,day)[2].pattern),['horizontal_push','vertical_push','horizontal_push']);
  }
});

test('v5 three-day hypertrophy retains its historic horizontal push-pull pattern',()=>{
  const plan=ctx.buildPlan({goal:'hypertrophy',experience:'intermediate',days:3,planRuleVersion:5,focusArea:'',focusPurpose:''},null);
  assert.ok(plan.split.every(day=>day[0].includes('水平推拉')));
  assert.ok([0,1,2].every(day=>ctx.movementDaySlots(plan,day)[2].pattern==='horizontal_push'));
});


test('previously saved v4 advanced three-day plans retain their full-body layout',()=>{
  const plan=ctx.buildPlan({goal:'hypertrophy',experience:'advanced',days:3,planRuleVersion:4,focusArea:'',focusPurpose:''},null);
  assert.ok(plan.split.every(day=>day[0].includes('全身训练')));
  assert.ok(ctx.movementDaySlots(plan,0).some(item=>item.pattern==='squat'));
});
