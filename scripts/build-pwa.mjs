import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const output = resolve(root, "dist-pwa");
const entries = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "app-icon.svg",
  "icon-192.png",
  "icon-512.png",
  "assets",
  "data",
  "config",
  "sync",
  "legal",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of entries) {
  await cp(resolve(root, entry), resolve(output, entry), { recursive: true });
}

const runtime = {
  supabaseUrl: process.env.FITLOG_SUPABASE_URL || "",
  supabaseAnonKey: process.env.FITLOG_SUPABASE_ANON_KEY || "",
  authRedirectUrl: process.env.FITLOG_AUTH_REDIRECT_URL || "",
};
const usesBuildTimeRuntime = Object.values(runtime).some(Boolean);
if (usesBuildTimeRuntime) {
  if (!runtime.supabaseUrl || !runtime.supabaseAnonKey) {
    throw new Error("FITLOG_SUPABASE_URL and FITLOG_SUPABASE_ANON_KEY must be set together.");
  }
  await writeFile(
    resolve(output, "config", "fitlog-runtime.js"),
    `window.FITLOG_RUNTIME = ${JSON.stringify(runtime, null, 2)};\n`,
  );
}

console.log(`FitLog PWA build complete: ${output}`);
