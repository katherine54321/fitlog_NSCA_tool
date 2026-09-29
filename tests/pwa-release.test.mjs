import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const output = new URL("../dist-pwa/", import.meta.url);

test("release build includes PWA runtime and exercise assets", async () => {
  const expected = [
    "index.html", "manifest.webmanifest", "sw.js", "config/fitlog-runtime.js",
    "sync/fitlog-sync.js", "data/exercises-v1.json", "assets/exercise-placeholder.svg",
    "legal/privacy.html", "legal/support.html",
  ];
  await Promise.all(expected.map((file) => access(new URL(file, output))));
});

test("PWA document declares installable and offline delivery assets", async () => {
  const [html, manifest, serviceWorker, releaseWorker] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("manifest.webmanifest", root), "utf8"),
    readFile(new URL("sw.js", root), "utf8"),
    readFile(new URL("sw.js", output), "utf8"),
  ]);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /src="\.\/sync\/fitlog-sync\.js"/);
  assert.match(html, /id="accountButton"/);
  assert.match(html, /id="myAccountButton"/);
  assert.match(html, /href="#fitness-assessment"/);
  assert.match(html, /href="#risk-assessment"/);
  assert.match(html, /<a href="#me"[^>]*>我的<\/a>/);
  assert.match(html, /id="homeTodayScheduleTitle">今日计划<\/strong>/);
  assert.match(html, /id="homeTodayPlan"/);
  assert.match(html, /下个训练日计划/);
  assert.match(html, /id="homeTrainingCalendarTitle">训练日历<\/strong>/);
  assert.match(html, /id="homeTrainingCalendarGrid"/);
  assert.match(html, /function renderHomeTrainingCalendar/);
  assert.match(html, /id="adjustTrainingDays"[^>]*>调整训练日<\/button>/);
  assert.match(html, /id="scheduleDialog"/);
  assert.match(html, /data-record-tab="trainingCalendarPane"/);
  assert.match(html, /id="recordCalendarGrid"/);
  assert.doesNotMatch(html, /<h2>数据记录<\/h2>/);
  assert.doesNotMatch(html, /id="completedTrainingTitle"/);
  assert.match(html, /<span>每组次数<\/span><strong id="planMetricReps">/);
  assert.doesNotMatch(html, /每组完成次数/);
  assert.doesNotMatch(html, /id="homePrimaryAction"/);
  assert.match(html, /<nav class="mobile-nav"[^>]*>[\s\S]*?<a href="#home"[^>]*>首页<\/a>\s*<a href="#training"[^>]*>动作库<\/a>\s*<a href="#plan"[^>]*>计划<\/a>\s*<a href="#records"[^>]*>记录<\/a>\s*<a href="#me"[^>]*>我的<\/a>/);
  assert.doesNotMatch(html, /<nav class="mobile-nav"[^>]*>[\s\S]*?<a href="#evaluation">评估<\/a>[\s\S]*?<\/nav>/);
  assert.match(html, /id="accountDelete"/);
  assert.match(html, /id="account-management"/);
  assert.match(html, /id="language-settings"/);
  assert.match(html, /name="appLanguage" value="en"/);
  assert.doesNotMatch(html, /id="accountSyncNow"/);
  assert.doesNotMatch(html, /训练数据备份/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.equal(JSON.parse(manifest).scope, "./");
  assert.match(serviceWorker, /manifest\.webmanifest/);
  assert.match(serviceWorker, /self\.registration\.scope/);
  assert.match(serviceWorker, /IMAGE_CACHE_NAME = "fitlog-exercise-images-v1"/);
  assert.match(serviceWorker, /isImageRequest\(event\.request\)/);
  assert.match(serviceWorker, /caches\.match\(IMAGE_PLACEHOLDER\)/);
  assert.match(serviceWorker, /catch\(\(\) => caches\.match\(event\.request\)\)/);
  assert.match(html, /decodeImageSource/);
  assert.match(html, /data-ready="false" data-loading="true"/);
  assert.match(html, /registration\.update\(\)\.catch/);
  assert.match(releaseWorker, /const CACHE_NAME = "fitlog-app-[a-f0-9]{12}"/);
});
