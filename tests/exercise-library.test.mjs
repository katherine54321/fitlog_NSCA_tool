import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [librarySource, importScript, expansionSource, appSource] = await Promise.all([
  readFile(new URL("../data/exercises-v1.json", import.meta.url), "utf8"),
  readFile(new URL("../scripts/import-exercises.mjs", import.meta.url), "utf8"),
  readFile(new URL("../data/exercise-expansion-v2.json", import.meta.url), "utf8"),
  readFile(new URL("../index.html", import.meta.url), "utf8")
]);
const exercises = JSON.parse(librarySource);
const expansion = JSON.parse(expansionSource);

const countBy = (items, property) =>
  items.reduce((counts, item) => {
    counts[item[property]] = (counts[item[property]] || 0) + 1;
    return counts;
  }, {});

test("exercise library contains 180 complete local exercises with balanced coverage", () => {
  assert.equal(exercises.length, 180);
  assert.equal(new Set(exercises.map((exercise) => exercise.id)).size, 180);
  assert.equal(exercises.filter((exercise) => !exercise.startImage || !exercise.endImage || !exercise.instructionsZh?.length).length, 0);

  const types = countBy(exercises, "libraryType");
  assert.deepEqual(types, { resistance: 150, warmup: 15, stretch: 15 });

  const categories = countBy(exercises, "category");
  assert.deepEqual(categories, {
    "胸部": 21,
    "背部": 22,
    "肩部": 21,
    "手臂": 22,
    "腿部": 24,
    "臀部": 19,
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

test("exercise importer merges the expansion catalog and list stays paginated", () => {
  assert.match(importScript, /exercise-expansion-v2\.json/);
  assert.match(importScript, /const exerciseConfigs = \{ \.\.\.terms\.exercises, \.\.\.expansion\.exercises \}/);
  assert.equal(Object.keys(expansion.exercises).length, 52);
  assert.match(appSource, /let libraryVisibleCount = 20/);
  assert.match(appSource, /libraryVisibleCount \+= 20/);
  assert.match(appSource, /renderExerciseCardGrid\("#warmupGrid", warmupExercises\)/);
  assert.match(appSource, /renderExerciseCardGrid\("#stretchGrid", stretchExercises\)/);
});
