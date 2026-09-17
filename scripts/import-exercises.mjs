import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceUrl = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const imageBaseUrl = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
const terms = JSON.parse(await readFile(join(root, "data", "exercise-terms.json"), "utf8"));
const expansion = JSON.parse(await readFile(join(root, "data", "exercise-expansion-v2.json"), "utf8"));
const outputJson = join(root, "data", "exercises-v1.json");
const outputScript = join(root, "data", "exercise-library-data.js");
const imageDir = join(root, "assets", "exercise-images");
const verbose = process.env.EXERCISE_IMPORT_VERBOSE === "1";

const translate = (value) => terms.terms[String(value || "").toLowerCase()] || value || "未提供";
const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 900));
    }
  }
  throw lastError;
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url);
  return response.json();
}

async function saveImage(remotePath, localName) {
  const localPath = join(imageDir, localName);
  if (existsSync(localPath)) return `assets/exercise-images/${localName}`;
  const response = await fetchWithRetry(`${imageBaseUrl}${remotePath}`);
  await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
  return `assets/exercise-images/${localName}`;
}

function findSourceExercise(source, config) {
  const matches = source.filter((exercise) => {
    const name = normalize(exercise.name);
    return config.match.some((term) => name === normalize(term));
  });
  return matches.find((exercise) => exercise.images?.length >= 1 && exercise.instructions?.length) || matches[0];
}

await mkdir(imageDir, { recursive: true });
const source = await fetchJson(sourceUrl);
const imported = [];
const seen = new Set();
const stats = { success: 0, skipped: 0, failed: 0 };

const exerciseConfigs = { ...terms.exercises, ...expansion.exercises };

for (const [id, config] of Object.entries(exerciseConfigs)) {
  try {
    const exercise = findSourceExercise(source, config);
    if (!exercise || seen.has(exercise.id) || !exercise.images?.length || !exercise.instructions?.length) {
      stats.skipped += 1;
      if (verbose) console.log(`跳过：${config.nameZh}（未找到完整源数据或重复）`);
      continue;
    }
    const imagePaths = await Promise.all(
      exercise.images.slice(0, 2).map((imagePath, index) => saveImage(imagePath, `${id}-${index}.jpg`))
    );
    seen.add(exercise.id);
    imported.push({
      id,
      nameZh: config.nameZh,
      nameEn: exercise.name,
      category: config.category,
      libraryType: config.libraryType || "resistance",
      level: translate(exercise.level),
      equipment: translate(exercise.equipment),
      force: translate(exercise.force),
      mechanic: translate(exercise.mechanic),
      primaryMuscles: (exercise.primaryMuscles || []).map(translate),
      secondaryMuscles: (exercise.secondaryMuscles || []).map(translate),
      instructionsZh: config.instructionsZh,
      instructionsEn: exercise.instructions,
      startImage: imagePaths[0] || null,
      endImage: imagePaths[1] || imagePaths[0] || null
    });
    stats.success += 1;
    if (verbose) console.log(`导入：${config.nameZh} / ${exercise.name}`);
  } catch (error) {
    stats.failed += 1;
    console.error(`失败：${config.nameZh} - ${error.message}`);
  }
}

await writeFile(outputJson, `${JSON.stringify(imported, null, 2)}\n`, "utf8");
await writeFile(outputScript, `window.EXERCISE_LIBRARY_DATA = ${JSON.stringify(imported)};\n`, "utf8");
console.log(`\n导入完成：成功 ${stats.success}，跳过 ${stats.skipped}，失败 ${stats.failed}。`);
console.log(`本地数据：${outputJson}`);
