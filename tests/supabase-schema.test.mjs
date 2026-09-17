import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/0001_fitlog_schema.sql", import.meta.url), "utf8");

test("schema covers accounts, training, assessments, subscriptions, and deletion", () => {
  for (const table of [
    "profiles", "exercises", "training_plans", "plan_workouts", "workout_sessions",
    "workout_sets", "risk_assessments", "cardio_assessments", "strength_assessments",
    "user_sync_snapshots", "subscriptions", "store_transactions", "account_deletion_requests",
  ]) assert.match(migration, new RegExp(`create table public\\.${table}`));
  assert.match(migration, /row level security/);
  assert.match(migration, /auth\.uid\(\)/);
});

test("assessment records preserve calculation and norm versions", () => {
  for (const table of ["risk_assessments", "cardio_assessments", "strength_assessments"]) {
    const section = migration.slice(migration.indexOf(`create table public.${table}`));
    assert.match(section.slice(0, 1800), /result_snapshot jsonb not null/);
  }
  assert.match(migration, /norms_version text not null/);
  assert.match(migration, /estimated_one_rm_kg/);
  assert.match(migration, /estimated_vo2max/);
});
