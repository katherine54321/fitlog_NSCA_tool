# FitMine Codex Guide

## Product Baseline
- Current product architecture: `index.html` + native HTML/CSS/JavaScript + PWA + Capacitor iOS.
- The user-visible production PWA is built by `scripts/build-pwa.mjs` into `dist-pwa/`.
- Production PWA source set: root files `index.html`, `manifest.webmanifest`, `sw.js`, `app-icon.svg`, `icon-192.png`, `icon-512.png`; root dirs `assets/`, `data/`, `config/`, `sync/`, `legal/`.
- GitHub Pages is the current public web release path. `worker/` is an optional Cloudflare static Worker path, not the main user request path.
- `app/`, `db/`, `drizzle/`, `examples/`, `worker/index.ts`, and Next/Vinext scaffolding are not current FitMine PWA business code unless a task explicitly targets them.

## Main Files And Directories
- `index.html`: single-page UI, styles, hash routing, plan generation, evaluation, records, and most app behavior.
- `data/exercises-v1.json`: canonical exercise library data.
- `data/exercise-library-data.js`: browser-loaded exercise data generated from the JSON/import flow.
- `assets/exercise-images/`: local exercise images whose names align with exercise IDs.
- `assets/exercise-placeholder.svg`: fallback image used by the PWA cache.
- `sync/fitlog-sync.js`: Supabase email OTP login, local snapshot backup/restore, structured training row sync, account deletion client.
- `config/fitlog-runtime.js`: public runtime config only; anon keys are allowed, secrets are not.
- `supabase/migrations/`: database schema, RLS policies, and migration compatibility path.
- `supabase/functions/delete-account/index.ts`: account deletion Edge Function; service role key is server-side only.
- `sw.js`: Service Worker cache strategy and cache version placeholder.
- `scripts/build-pwa.mjs`: copies production sources and replaces the Service Worker cache name with a content digest.
- `capacitor.config.ts`: Capacitor app id/name and `webDir: "dist-pwa"`.
- `ios/`: Capacitor iOS project for Xcode signing, archive, App Store, and WebView verification.
- `legal/`: privacy and support pages copied into the production PWA.
- `tests/`: focused Node tests for rendered HTML, PWA release, sync, schema, iOS release, exercise library, and app logic.

## What To Read By Task
- UI, routing, plan/evaluation/records behavior: start with `index.html`; use relevant tests under `tests/`.
- Exercise/action library changes: read `data/exercises-v1.json`, `data/exercise-library-data.js`, `scripts/import-exercises.mjs`, and image paths in `assets/exercise-images/`.
- Sync/login/restore/delete-account changes: read `sync/fitlog-sync.js`, `config/fitlog-runtime.js`, `supabase/functions/delete-account/index.ts`, and `tests/sync-client.test.mjs`.
- Supabase schema or migration changes: read `supabase/migrations/`, `tests/supabase-schema.test.mjs`, and any affected sync code.
- PWA install/offline/cache/release changes: read `manifest.webmanifest`, `sw.js`, `scripts/build-pwa.mjs`, `tests/pwa-release.test.mjs`, and `.github/workflows/deploy-pages.yml`.
- iOS tasks: read `capacitor.config.ts`, `ios/App/App/Info.plist`, `ios/App/App/AppDelegate.swift`, iOS assets, and `tests/ios-release.test.mjs`.
- Deployment or operations tasks: read `docs/DEPLOYMENT.md`.
- App Store tasks: read `docs/APP_STORE_SUBMISSION.md`.
- Architecture/background tasks: read `docs/技术架构与维护指南.md`.
- Do not read every document by default; pick only the task-relevant files above.

## Guardrails
- Preserve stable `exerciseId` values when changing exercises. Historical plans, records, images, and sync rows depend on them.
- If an exercise must be renamed or replaced, keep the old ID or provide an explicit alias/migration plan.
- Storage structure changes must include data migration and backward compatibility for existing `localStorage` `fitlog-*` data and cloud snapshots.
- Database tables that contain user data must enable and test RLS. Policies should scope access with `auth.uid()` or equivalent ownership joins.
- Keep `user_sync_snapshots` compatible until all supported clients can restore through newer structured tables.
- Never commit database passwords, Supabase service role keys, SMTP passwords, Apple private keys, signing credentials, or other secrets.
- `config/fitlog-runtime.js` and built PWA config may contain only public client configuration such as Supabase URL and anon/publishable key.
- Health/risk features are training references, not medical diagnosis or treatment claims.

## Verification
- Run only tests related to the current change.
- For PWA release/cache edits: `pnpm build` and the relevant PWA test.
- For sync edits: `node --test tests/sync-client.test.mjs` plus schema tests if migrations changed.
- For Supabase migrations: `node --test tests/supabase-schema.test.mjs`.
- For iOS metadata/assets: `node --test tests/ios-release.test.mjs`.
- For exercise data: `node --test tests/exercise-library.test.mjs`.
- For broad cross-module changes, run `pnpm test`.
- Avoid regenerating or touching `dist-pwa/` unless the task asks for build output or release verification requires it.
