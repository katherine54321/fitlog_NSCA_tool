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
  assert.match(html, /id="accountDelete"/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.equal(JSON.parse(manifest).scope, "./");
  assert.match(serviceWorker, /manifest\.webmanifest/);
  assert.match(serviceWorker, /self\.registration\.scope/);
  assert.match(html, /registration\.update\(\)\.catch/);
  assert.match(releaseWorker, /const CACHE_NAME = "fitlog-app-[a-f0-9]{12}"/);
});
