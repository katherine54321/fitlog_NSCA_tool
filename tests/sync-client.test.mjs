import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../sync/fitlog-sync.js", import.meta.url), "utf8");

test("sync remains account-scoped and never embeds privileged credentials", () => {
  assert.match(source, /const configured = \(\) => Boolean\(runtime\.supabaseUrl && runtime\.supabaseAnonKey\)/);
  assert.match(source, /user_sync_snapshots/);
  assert.match(source, /window\.addEventListener\("online"/);
  assert.match(source, /function startAutoSync/);
  assert.match(source, /function queueSync/);
  assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE/);
});

test("sync payload excludes its own credential and revision keys", () => {
  assert.match(source, /key !== sessionKey && key !== stateKey/);
  assert.match(source, /startsWith\(storagePrefix\)/);
  assert.match(source, /on_conflict=user_id/);
  assert.match(source, /workout_sessions/);
  assert.match(source, /workout_exercises/);
  assert.match(source, /workout_sets/);
  assert.match(source, /functions\/v1\/delete-account/);
  assert.match(source, /accountConsent/);
});

test("syncNow keeps the legacy snapshot and upserts structured training rows", async () => {
  const page = createSyncClientHarness();
  vm.runInNewContext(source, page.context);
  page.localStorage.setItem("fitlog-sync-session", JSON.stringify({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    email: "user@example.com",
    userId: "user-123",
  }));
  seedTrainingSnapshot(page.localStorage);

  await page.context.window.FitLogSync.syncNow();

  const snapshotCall = page.fetchCalls.find((call) => call.url.includes("/rest/v1/user_sync_snapshots?on_conflict="));
  assert.ok(snapshotCall);
  const snapshotBody = JSON.parse(snapshotCall.options.body);
  assert.ok(snapshotBody.snapshot["fitlog-records"]);
  assert.ok(snapshotBody.snapshot["fitlog-training-set-logs"]);

  const sessions = structuredBody(page, "workout_sessions");
  const exercises = structuredBody(page, "workout_exercises");
  const sets = structuredBody(page, "workout_sets");
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].user_id, "user-123");
  assert.equal(sessions[0].client_id, "plan:2026-09-25-strength-beginner-3-w1-d1");
  assert.equal(sessions[0].source_snapshot_key, "fitlog-training-set-logs");
  assert.equal(sessions[0].status, "completed");
  assert.equal(exercises.length, 1);
  assert.equal(exercises[0].exercise_id, "barbell-bench-press");
  assert.equal(exercises[0].planned_rep_min, 8);
  assert.equal(sets.length, 3);
  assert.deepEqual(sets.map((set) => set.set_number), [1, 2, 3]);
  assert.equal(sets[0].weight_kg, 60);
});

test("pullLatest restores old snapshots and migrates them into structured tables", async () => {
  const remoteSnapshot = trainingSnapshot();
  const page = createSyncClientHarness({
    remoteSnapshots: [{ snapshot: remoteSnapshot, client_updated_at: "2026-09-25T08:00:00.000Z" }],
  });
  vm.runInNewContext(source, page.context);
  page.localStorage.setItem("fitlog-sync-session", JSON.stringify({
    accessToken: "access-token",
    refreshToken: "refresh-token",
    email: "user@example.com",
    userId: "user-123",
  }));

  const restored = await page.context.window.FitLogSync.pullLatest();

  assert.equal(restored, true);
  assert.equal(page.localStorage.getItem("fitlog-records"), remoteSnapshot["fitlog-records"]);
  assert.equal(structuredBody(page, "workout_sessions").length, 1);
  assert.equal(structuredBody(page, "workout_sets").length, 3);
});

test("page router preserves Supabase email callback tokens until the sync client consumes them", async () => {
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

test("email code login requests and verifies Supabase OTP without redirect tokens", () => {
  assert.match(source, /function requestEmailOtp/);
  assert.match(source, /function verifyEmailOtp/);
  assert.match(source, /body: JSON\.stringify\(\{ email, create_user: true \}\)/);
  assert.match(source, /body: JSON\.stringify\(\{ email, token, type: "email" \}\)/);
  assert.doesNotMatch(source, /email_redirect_to/);
  assert.match(source, /errorBody\?\.msg \|\| errorBody\?\.message \|\| errorBody\?\.error_description/);
});

test("account status follows the saved interface language", async () => {
  const page = createSyncClientHarness();
  page.localStorage.setItem("fitlog-language", "en");
  vm.runInNewContext(source, page.context);

  await page.context.window.FitLogSync.init();

  assert.equal(page.elements.myAccountTitle.textContent, "Not signed in");
  assert.equal(page.elements.myAccountHint.textContent, "Tap to sign in");
  assert.equal(page.elements.myAccountAction.textContent, "Sign in");
});

test("email code login reveals OTP input immediately and completes verification", async () => {
  const page = createSyncClientHarness();
  vm.runInNewContext(source, page.context);

  await page.context.window.FitLogSync.init();
  assert.equal(page.elements.myAccountTitle.textContent, "未登录");
  assert.equal(page.elements.myAccountAction.textContent, "登录");
  await page.elements.myAccountButton.click();
  assert.equal(page.elements.accountDialog.open, true);
  page.elements.accountEmail.value = "USER@example.COM";
  page.elements.accountConsent.checked = true;

  const sendPromise = page.elements.accountSendCode.click();
  assert.equal(page.elements.accountOtpStep.hidden, false);
  assert.equal(page.elements.accountSendCode.hidden, true);
  assert.equal(page.elements.accountEmail.disabled, true);
  assert.equal(page.elements.accountMessage.textContent, "正在发送验证码…");

  page.resolveOtpRequest();
  await sendPromise;
  assert.equal(page.elements.accountMessage.textContent, "验证码已发送，请查看邮箱并在此输入。");

  page.elements.accountOtp.value = " 123 456 ";
  await page.elements.accountVerifyCode.click();

  const verifyRequest = page.fetchCalls.find((call) => call.url.endsWith("/auth/v1/verify"));
  assert.deepEqual(JSON.parse(verifyRequest.options.body), {
    email: "user@example.com",
    token: "123456",
    type: "email",
  });
  assert.equal(page.elements.accountSignedOut.hidden, false);
  assert.equal(page.elements.accountEmailValue.textContent, "user@example.com");
  assert.equal(page.elements.myAccountTitle.textContent, "user@example.com");
  assert.equal(page.elements.myAccountAction.textContent, "管理");
  assert.equal(page.context.window.location.hash, "account-management");

  const session = JSON.parse(page.localStorage.getItem("fitlog-sync-session"));
  assert.equal(session.email, "user@example.com");
  assert.equal(session.userId, "user-123");
});

function createSyncClientHarness(options = {}) {
  let resolveOtpRequest;
  const fetchCalls = [];
  const remoteSnapshots = options.remoteSnapshots || [];
  const elements = Object.fromEntries([
    "accountButton",
    "myAccountButton",
    "myAccountTitle",
    "myAccountHint",
    "myAccountAction",
    "accountDialog",
    "accountSignedOut",
    "accountEmailValue",
    "accountEmail",
    "accountConsent",
    "accountSendCode",
    "accountOtpStep",
    "accountOtp",
    "accountVerifyCode",
    "accountChangeEmail",
    "accountSignOut",
    "accountDelete",
    "accountMessage",
    "accountManagementMessage",
  ].map((id) => [id, createElement(id)]));

  elements.accountOtpStep.hidden = true;
  const localStorage = createLocalStorage();
  const accessToken = jwt({ sub: "user-123" });

  const context = {
    atob: (value) => Buffer.from(value, "base64").toString("binary"),
    document: {
      title: "FitMine",
      querySelector(selector) {
        return selector.startsWith("#") ? elements[selector.slice(1)] || null : null;
      },
    },
    fetch: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      if (url.endsWith("/auth/v1/otp")) {
        await new Promise((resolve) => {
          resolveOtpRequest = resolve;
        });
        return okResponse({});
      }
      if (url.endsWith("/auth/v1/verify")) {
        return okResponse({
          access_token: accessToken,
          refresh_token: "refresh-token",
          user: { id: "user-123", email: "user@example.com" },
        });
      }
      if (url.includes("/rest/v1/user_sync_snapshots?user_id=")) return okResponse(remoteSnapshots);
      if (url.includes("/rest/v1/user_sync_snapshots?on_conflict=")) return okResponse([]);
      if (/\/rest\/v1\/(workout_sessions|workout_exercises|workout_sets)\?on_conflict=id/.test(url)) return okResponse([]);
      if (url.includes("/rest/v1/user_consents?on_conflict=")) return okResponse([]);
      throw new Error(`Unexpected fetch: ${url}`);
    },
    history: { replaceState() {} },
    localStorage,
    URL,
    URLSearchParams,
    window: {
      FITLOG_RUNTIME: {
        supabaseUrl: "https://fitmine.example",
        supabaseAnonKey: "anon-key",
      },
      addEventListener() {},
      confirm: () => true,
      location: {
        href: "https://fitmine.example/",
        origin: "https://fitmine.example",
        pathname: "/",
        search: "",
        hash: "",
        reload() {},
      },
    },
  };
  context.window.document = context.document;
  context.window.history = context.history;
  context.window.localStorage = localStorage;
  context.window.URL = URL;
  context.window.URLSearchParams = URLSearchParams;

  return {
    context,
    elements,
    fetchCalls,
    localStorage,
    resolveOtpRequest: () => resolveOtpRequest(),
  };
}

function trainingSnapshot() {
  const planDayId = "2026-09-25-strength-beginner-3-w1-d1";
  return {
    "fitlog-records": JSON.stringify([{
      id: `plan-${planDayId}`,
      planDayId,
      source: "plan",
      date: "2026-09-25",
      name: "上肢训练",
      description: "卧推主项",
      actions: 1,
      rm: "80-82.5% 1RM",
      exercises: [{
        exerciseId: "barbell-bench-press",
        name: "杠铃卧推",
        sets: 3,
        prescription: "3 组 × 8 次",
        loadKg: "60",
      }],
      completedAt: "2026-09-25T07:30:00.000Z",
    }]),
    "fitlog-training-set-logs": JSON.stringify([{
      id: `plan-set-${planDayId}-0`,
      source: "plan",
      planDayId,
      date: "2026-09-25",
      exerciseId: "barbell-bench-press",
      exerciseName: "杠铃卧推",
      category: "胸部",
      sets: 3,
      reps: 8,
      weightKg: 60,
      estimated1RM: 75,
      notes: "已完成 上肢训练",
      createdAt: "2026-09-25T07:30:00.000Z",
    }]),
    "fitlog-plan-completed": JSON.stringify([planDayId]),
  };
}

function seedTrainingSnapshot(localStorage) {
  Object.entries(trainingSnapshot()).forEach(([key, value]) => localStorage.setItem(key, value));
}

function structuredBody(page, table) {
  const call = page.fetchCalls.find((item) => item.url.includes(`/rest/v1/${table}?on_conflict=id`));
  assert.ok(call, `missing ${table} upsert`);
  return JSON.parse(call.options.body);
}

function createElement(id) {
  const listeners = new Map();
  return {
    id,
    checked: false,
    disabled: false,
    hidden: false,
    textContent: "",
    value: "",
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    click() {
      return listeners.get("click")?.({ preventDefault() {} });
    },
    focus() {
      this.focused = true;
    },
    showModal() {
      this.open = true;
    },
  };
}

function createLocalStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    key(index) {
      return Array.from(store.keys())[index] || null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
  };
}

function okResponse(body) {
  return {
    ok: true,
    json: async () => body,
  };
}

function jwt(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encodedPayload}.signature`;
}
