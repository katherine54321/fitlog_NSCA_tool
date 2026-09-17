import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../sync/fitlog-sync.js", import.meta.url), "utf8");

test("sync remains opt-in and never embeds privileged credentials", () => {
  assert.match(source, /const configured = \(\) => Boolean\(runtime\.supabaseUrl && runtime\.supabaseAnonKey\)/);
  assert.match(source, /user_sync_snapshots/);
  assert.match(source, /window\.addEventListener\("online"/);
  assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE/);
});

test("sync payload excludes its own credential and revision keys", () => {
  assert.match(source, /key !== sessionKey && key !== stateKey/);
  assert.match(source, /startsWith\(storagePrefix\)/);
  assert.match(source, /on_conflict=user_id/);
  assert.match(source, /functions\/v1\/delete-account/);
  assert.match(source, /accountConsent/);
});

test("page router preserves a Supabase magic-link hash until the sync client consumes it", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /authHash\.has\("access_token"\) && authHash\.has\("refresh_token"\)/);
  assert.match(html, /authQuery\.has\("token_hash"\) && authQuery\.get\("type"\) === "email"/);
});

test("sync client supports Supabase token-hash email callbacks without exposing tokens to the router", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(source, /function verifyEmailToken/);
  assert.match(source, /auth\/v1\/verify/);
  assert.match(source, /token_hash: verification\.tokenHash/);
  assert.match(html, /authQuery\.has\("token_hash"\) && authQuery\.get\("type"\) === "email"/);
});
