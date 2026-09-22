import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

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

test("email code login reveals OTP input immediately and completes verification", async () => {
  const page = createSyncClientHarness();
  vm.runInNewContext(source, page.context);

  await page.context.window.FitLogSync.init();
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
  assert.equal(page.elements.accountSignedOut.hidden, true);
  assert.equal(page.elements.accountSignedIn.hidden, false);
  assert.equal(page.elements.accountEmailValue.textContent, "user@example.com");

  const session = JSON.parse(page.localStorage.getItem("fitlog-sync-session"));
  assert.equal(session.email, "user@example.com");
  assert.equal(session.userId, "user-123");
});

function createSyncClientHarness() {
  let resolveOtpRequest;
  const fetchCalls = [];
  const elements = Object.fromEntries([
    "accountButton",
    "accountDialog",
    "accountSignedOut",
    "accountSignedIn",
    "accountState",
    "accountEmailValue",
    "accountEmail",
    "accountConsent",
    "accountSendCode",
    "accountOtpStep",
    "accountOtp",
    "accountVerifyCode",
    "accountChangeEmail",
    "accountSyncNow",
    "accountSignOut",
    "accountDelete",
    "accountMessage",
  ].map((id) => [id, createElement(id)]));

  elements.accountOtpStep.hidden = true;
  elements.accountSignedIn.hidden = true;
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
      if (url.includes("/rest/v1/user_sync_snapshots?user_id=")) return okResponse([]);
      if (url.includes("/rest/v1/user_sync_snapshots?on_conflict=")) return okResponse([]);
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
