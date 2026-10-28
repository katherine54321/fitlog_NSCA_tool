import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../supabase/functions/delete-account/index.ts", import.meta.url), "utf8");

test("account deletion authenticates the requester and keeps privileged key server-side", () => {
  assert.match(source, /auth\.getUser\(\)/);
  assert.match(source, /auth\.admin\.deleteUser\(user\.id\)/);
  assert.doesNotMatch(source, /auth\.admin\.deleteUser\(user\.id,\s*true\)/);
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /Access-Control-Allow-Headers/);
  assert.doesNotMatch(source, /FITLOG_SUPABASE_ANON_KEY/);
});

test("Apple accounts attempt server-side token revocation before deletion", () => {
  assert.match(source, /APPLE_PRIVATE_KEY/);
  assert.match(source, /appleid\.apple\.com\/auth\/token/);
  assert.match(source, /appleid\.apple\.com\/auth\/revoke/);
  assert.match(source, /payload\.sub !== appleSubject/);
  assert.match(source, /appleRevocationRequired: hasAppleIdentity && !appleRevoked/);
  assert.ok(source.indexOf("revokeAppleAuthorization(code, appleSubject)") < source.indexOf("admin.deleteUser(user.id)"));
});
