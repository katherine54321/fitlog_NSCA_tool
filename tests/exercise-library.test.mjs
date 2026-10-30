import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [librarySource, importScript, expansionSource, appSource, patternsSource, browserSource] = await Promise.all([
  readFile(new URL("../data/exercises-v1.json", import.meta.url), "utf8"),
  readFile(new URL("../scripts/import-exercises.mjs", import.meta.url), "utf8"),
  readFile(new URL("../data/exercise-expansion-v2.json", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../data/exercise-movement-patterns.json", import.meta.url), "utf8"),
  readFile(new URL("../data/exercise-library-data.js", import.meta.url), "utf8")
]);
const exercises = JSON.parse(librarySource);
const expansion = JSON.parse(expansionSource);
const patterns = JSON.parse(patternsSource);

test("reviewed exercise mechanics persist through the import pipeline", async () => {
  const overrides = JSON.parse(await readFile(new URL("../data/exercise-mechanic-overrides.json", import.meta.url), "utf8"));
  assert.equal(Object.keys(overrides).length, 5);
  for (const [id, mechanic] of Object.entries(overrides)) {
    assert.equal(exercises.find((exercise) => exercise.id === id)?.mechanic, mechanic, id);
  }
  assert.match(importScript, /mechanicOverrides\[id\]/);
});

test("resistance exercises carry stable movement families and internal candidate roles", async () => {
  const classifications = JSON.parse(await readFile(new URL("../data/exercise-training-classification.json", import.meta.url), "utf8"));
  const resistance = exercises.filter((item) => item.libraryType === "resistance");
  const families = new Set(["power", "lower_push", "lower_pull", "upper_push", "upper_pull", "core"]);
  assert.equal(Object.keys(classifications.exercises).length, resistance.length);
  for (const item of resistance) {
    assert.deepEqual({ movementFamily: item.movementFamily, roles: item.roles }, classifications.exercises[item.id], item.id);
    assert.ok(families.has(item.movementFamily), item.id);
    assert.ok(item.roles.length > 0 && item.roles.every((role) => ["main", "accessory"].includes(role)), item.id);
  }
  for (const item of exercises.filter((exercise) => exercise.libraryType !== "resistance")) {
    assert.equal(item.movementFamily, undefined, item.id);
    assert.equal(item.roles, undefined, item.id);
  }
  const byId = Object.fromEntries(resistance.map((item) => [item.id, item]));
  assert.equal(byId["barbell-squat"].movementFamily, "lower_push");
  assert.equal(byId["romanian-deadlift"].movementFamily, "lower_pull");
  assert.equal(byId["barbell-bench-press"].movementFamily, "upper_push");
  assert.equal(byId["upright-barbell-row"].movementFamily, "upper_pull");
  assert.equal(byId["pallof-press"].movementFamily, "core");
  assert.deepEqual(byId["barbell-bench-press"].roles, ["main", "accessory"]);
  assert.deepEqual(byId["side-lateral-raise"].roles, ["accessory"]);
  assert.match(importScript, /Missing reviewed training classifications/);
  assert.match(appSource, /exerciseMovementFamilyLabel\(exercise\)/);
  assert.doesNotMatch(appSource, /<span>发力方式<\/span><b>\$\{translateInterfaceText\(exercise\.force\)\}/);
});

test("power exercises include local frames, instructions and power-only classification", async () => {
  const ids = ["power-clean", "hang-clean", "barbell-push-press", "front-box-jump", "freehand-jump-squat", "medicine-ball-chest-pass"];
  for (const id of ids) {
    const item = exercises.find((exercise) => exercise.id === id);
    assert.ok(item, id);
    assert.equal(item.movementFamily, "power", id);
    assert.deepEqual(item.movementPatterns, ["power"], id);
    assert.ok(item.roles.includes("main"), id);
    assert.ok(item.instructionsZh.length && item.instructionsEn.length, id);
    for (const image of [item.startImage, item.endImage]) await access(new URL(`../${image}`, import.meta.url));
  }
  assert.match(importScript, /config\.instructionsEn \|\| exercise\.instructions/);
});

test("movement patterns cover resistance exercises and match browser data", () => {
  const resistance = exercises.filter((item) => item.libraryType === "resistance");
  assert.equal(Object.keys(patterns.exercises).length, resistance.length);
  for (const exercise of resistance) {
    assert.deepEqual(exercise.movementPatterns, patterns.exercises[exercise.id], exercise.id);
    assert.equal(exercise.movementPatterns.length, 1, exercise.id);
    assert.match(exercise.movementPatterns[0], /^[a-z_]+$/, exercise.id);
  }
  for (const exercise of exercises.filter((item) => item.libraryType !== "resistance")) {
    assert.equal(exercise.movementPatterns, undefined, exercise.id);
  }
  const browserData = JSON.parse(browserSource.replace(/^window\.EXERCISE_LIBRARY_DATA = /, "").trim().replace(/;$/, ""));
  assert.deepEqual(browserData, exercises);
  for (const [id, expected] of Object.entries({
    "romanian-deadlift": "hip_hinge", "barbell-squat": "squat",
    "leg-press": "squat", "pallof-press": "trunk_anti_rotation",
    "cable-crossover": "shoulder_horizontal_adduction", "lat-pulldown": "vertical_pull"
  })) assert.deepEqual(patterns.exercises[id], [expected], id);
  assert.match(importScript, /exercise-movement-patterns\.json/);
  assert.match(importScript, /Missing reviewed movement patterns/);
});

const countBy = (items, property) =>
  items.reduce((counts, item) => {
    counts[item[property]] = (counts[item[property]] || 0) + 1;
    return counts;
  }, {});

test("exercise library contains 189 complete local exercises with balanced coverage", () => {
  assert.equal(exercises.length, 189);
  assert.equal(new Set(exercises.map((exercise) => exercise.id)).size, 189);
  assert.equal(exercises.filter((exercise) => !exercise.startImage || !exercise.endImage || !exercise.instructionsZh?.length).length, 0);

  const types = countBy(exercises, "libraryType");
  assert.deepEqual(types, { resistance: 159, warmup: 15, stretch: 15 });

  const categories = countBy(exercises, "category");
  assert.deepEqual(categories, {
    "胸部": 22,
    "背部": 22,
    "肩部": 22,
    "手臂": 22,
    "腿部": 28,
    "臀部": 22,
    "核心": 21,
    "热身": 15,
    "拉伸": 15
  });
});

test("exercise equipment labels are normalized to the supported taxonomy", () => {
  const supportedEquipment = new Set(["杠铃", "哑铃", "徒手", "绳索器械", "固定器械", "药球", "其他", "弹力带", "健身球"]);
  assert.equal(exercises.filter((exercise) => ["未提供", "kettlebells", "曲杆"].includes(exercise.equipment)).length, 0);
  assert.equal(exercises.filter((exercise) => !supportedEquipment.has(exercise.equipment)).length, 0);

  const equipmentById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise.equipment]));
  for (const id of [
    "arm-circles", "ankle-circles", "triceps-stretch", "upper-back-stretch", "kneeling-hip-flexor",
    "bodyweight-walking-lunge", "dynamic-back-stretch", "dynamic-chest-stretch",
    "elbow-circles", "elbows-back", "shoulder-circles", "worlds-greatest-stretch", "calf-stretch-hands-wall",
    "childs-pose", "seated-hamstring-stretch", "standing-soleus-achilles-stretch", "spinal-stretch", "tricep-side-stretch"
  ]) assert.equal(equipmentById[id], "徒手", id);
  for (const id of ["inverted-row", "goblet-squat", "lunge-pass-through", "kettlebell-one-legged-deadlift"]) {
    assert.equal(equipmentById[id], "其他", id);
  }
  for (const id of ["lying-triceps-press", "ez-bar-curl", "ez-bar-skullcrusher"]) {
    assert.equal(equipmentById[id], "杠铃", id);
  }
});

test("glute machine filter includes common abduction, unilateral squat, and hinge exercises", () => {
  const machineGluteExercises = exercises.filter((exercise) => exercise.category === "臀部" && exercise.equipment === "固定器械");
  assert.equal(machineGluteExercises.length, 4);
  assert.deepEqual(
    machineGluteExercises.map((exercise) => exercise.id).sort(),
    ["glute-ham-raise", "seated-hip-abduction", "smith-machine-pistol-squat", "smith-machine-stiff-legged-deadlift"].sort()
  );
});

test("exercise importer merges the expansion catalog and list stays paginated", () => {
  assert.match(importScript, /exercise-expansion-v2\.json/);
  assert.match(importScript, /const exerciseConfigs = \{ \.\.\.terms\.exercises, \.\.\.expansion\.exercises \}/);
  assert.equal(Object.keys(expansion.exercises).length, 61);
  assert.match(appSource, /let libraryVisibleCount = 20/);
  assert.match(appSource, /libraryVisibleCount \+= 20/);
  assert.match(appSource, /renderExerciseCardGrid\("#warmupGrid", warmupExercises\)/);
  assert.match(appSource, /renderExerciseCardGrid\("#stretchGrid", stretchExercises\)/);
});
