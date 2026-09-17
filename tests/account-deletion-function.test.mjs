import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../supabase/functions/delete-account/index.ts", import.meta.url), "utf8");

test("account deletion authenticates the requester and keeps privileged key server-side", () => {
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /auth\.admin\.deleteUser\(user\.id, true\)/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /Access-Control-Allow-Headers/);
  assert.doesNotMatch(source, /FITLOG_SUPABASE_ANON_KEY/);
});
