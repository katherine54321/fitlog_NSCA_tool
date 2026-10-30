import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const output = new URL("../dist-pwa/", import.meta.url);

test("release build includes PWA runtime and exercise assets", async () => {
  const expected = [
    "index.html", "manifest.webmanifest", "sw.js", "config/fitlog-runtime.js",
    "sync/fitlog-sync.js", "data/exercises-v1.json", "assets/exercise-placeholder.svg",
    "legal/privacy.html", "legal/support.html", "legal/privacy-choices.html",
    "legal/privacy-en.html", "legal/support-en.html", "legal/privacy-choices-en.html",
  ];
  await Promise.all(expected.map((file) => access(new URL(file, output))));
});

test("English legal pages expose support and account deletion information", async () => {
  const [privacy, choices, support] = await Promise.all([
    readFile(new URL("legal/privacy-en.html", output), "utf8"),
    readFile(new URL("legal/privacy-choices-en.html", output), "utf8"),
    readFile(new URL("legal/support-en.html", output), "utf8"),
  ]);
  assert.match(privacy, /<html lang="en">/);
  assert.match(privacy, /Supabase/);
  assert.match(privacy, /Resend/);
  assert.match(privacy, /privacy-choices-en\.html/);
  assert.match(choices, /Delete account and cloud data/);
  assert.match(support, /mailto:support@fitminetech\.com/);
});

test("PWA document declares installable and offline delivery assets", async () => {
  const [html, manifest, serviceWorker, releaseWorker] = await Promise.all([
    readFile(new URL("index.html", root), "utf8"),
    readFile(new URL("manifest.webmanifest", root), "utf8"),
    readFile(new URL("sw.js", root), "utf8"),
    readFile(new URL("sw.js", output), "utf8"),
  ]);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /rel="preload" href="data\/exercise-library-data\.js" as="script"/);
  assert.doesNotMatch(serviceWorker, /"data\/exercises-v1\.json"/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/);
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
  assert.match(html, /id="me"[\s\S]*?href="#settings"/);
  assert.match(html, /id="settings"[\s\S]*?href="#language-settings"/);
  assert.match(html, /id="language-settings"/);
  assert.match(html, /id="language-settings"[\s\S]*?href="#settings"/);
  assert.match(html, /name="appLanguage" value="en"/);
  assert.match(html, /id="accountPrivacyLink" href="\.\/legal\/privacy\.html"/);
  assert.match(html, /appLanguage === "en" \? "\.\/legal\/privacy-en\.html" : "\.\/legal\/privacy\.html"/);
  assert.match(html, /id="settingsPrivacyLink" href="\.\/legal\/privacy\.html"/);
  assert.match(html, /id="settingsSupportLink" href="\.\/legal\/support\.html"/);
  assert.match(html, /function localizeInterfaceAttributes/);
  assert.match(html, /function findUnexpectedChinese/);
  assert.match(html, /window\.FitMineI18n/);
  assert.match(html, /Movement adaptation/);
  assert.match(html, /Training day \$\{todayWorkout\.dayIndex \+ 1\}/);
  assert.match(html, /exercise\.nameEn \|\| exercise\.nameZh/);
  assert.doesNotMatch(html, /id="accountSyncNow"/);
  assert.doesNotMatch(html, /训练数据备份/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.equal(JSON.parse(manifest).name, "FitMine");
  assert.equal(JSON.parse(manifest).short_name, "FitMine");
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
  assert.match(html, /<body class="is-booting">/);
  assert.match(html, /id="appBoot"/);
  assert.match(html, /id="appShell" aria-busy="true"/);
  assert.match(html, /function completeAppBoot\(activeId\)/);
  assert.match(html, /document\.body\.classList\.remove\("is-booting"\)/);
  assert.match(html, /const hadServiceWorkerController = Boolean\(navigator\.serviceWorker\.controller\)/);
  assert.match(html, /if \(!hadServiceWorkerController \|\| serviceWorkerRefreshPending\) return/);
  assert.match(html, /const initializedModules = new Set\(\)/);
  assert.match(html, /function initializeModule\(moduleId\)/);
  assert.match(html, /initializeModule\(activeId\)/);
  assert.match(html, /applyLanguage\(appLanguage, \{ persist: false, rerender: false, localize: false \}\)/);
  assert.match(html, /const activeModuleId = syncModuleTabs\(\) \|\| "home"/);
  assert.doesNotMatch(html, /\n\s*renderPlan\(\);\n\s*if \(savedCardioAssessment\?\.cardioWeight\)/);
  assert.match(releaseWorker, /const CACHE_NAME = "fitlog-app-[a-f0-9]{12}"/);
});
