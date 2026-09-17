(() => {
  const runtime = window.FITLOG_RUNTIME || {};
  const storagePrefix = "fitlog-";
  const sessionKey = "fitlog-sync-session";
  const stateKey = "fitlog-sync-state";
  const backupTable = "user_sync_snapshots";

  const configured = () => Boolean(runtime.supabaseUrl && runtime.supabaseAnonKey);
  const api = (path) => `${String(runtime.supabaseUrl || "").replace(/\/$/, "")}${path}`;

  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(sessionKey) || "null");
    } catch {
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem(sessionKey, JSON.stringify(session));
  }

  function clearSession() {
    localStorage.removeItem(sessionKey);
    localStorage.removeItem(stateKey);
  }

  function clearLocalFitLogData() {
    const keys = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(storagePrefix)) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  }

  function userIdFromToken(token) {
    try {
      const payload = token.split(".")[1];
      return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).sub || null;
    } catch {
      return null;
    }
  }

  function storageSnapshot() {
    const snapshot = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(storagePrefix) && key !== sessionKey && key !== stateKey) {
        snapshot[key] = localStorage.getItem(key);
      }
    }
    return snapshot;
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return;
    Object.entries(snapshot).forEach(([key, value]) => {
      if (key.startsWith(storagePrefix) && typeof value === "string") localStorage.setItem(key, value);
    });
  }

  function headers(token, extra = {}) {
    return {
      apikey: runtime.supabaseAnonKey,
      Authorization: `Bearer ${token || runtime.supabaseAnonKey}`,
      ...extra,
    };
  }

  async function requestMagicLink(email) {
    if (!configured()) throw new Error("云端服务尚未配置，请联系管理员。");
    const redirectTo = runtime.authRedirectUrl || window.location.origin + window.location.pathname;
    const response = await fetch(api("/auth/v1/otp"), {
      method: "POST",
      headers: headers(null, { "Content-Type": "application/json" }),
      body: JSON.stringify({ email, create_user: true, email_redirect_to: redirectTo }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const detail = errorBody?.msg || errorBody?.message || errorBody?.error_description;
      throw new Error(detail ? `登录链接发送失败：${String(detail).slice(0, 160)}` : "登录链接发送失败，请稍后重试。");
    }
  }

  function captureHashSession(url = window.location.href) {
    const hash = new URLSearchParams(new URL(url).hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (!accessToken || !refreshToken) return false;
    saveSession({ accessToken, refreshToken, email: hash.get("email") || "", userId: userIdFromToken(accessToken) });
    history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    return true;
  }

  function emailVerificationParams(url = window.location.href) {
    const params = new URL(url).searchParams;
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    return tokenHash && type === "email" ? { tokenHash, type } : null;
  }

  function clearEmailVerificationParams() {
    const url = new URL(window.location.href);
    url.searchParams.delete("token_hash");
    url.searchParams.delete("type");
    history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }

  async function verifyEmailToken(url = window.location.href) {
    const verification = emailVerificationParams(url);
    if (!verification) return false;
    if (!configured()) throw new Error("云端服务尚未配置，请联系管理员。");

    const response = await fetch(api("/auth/v1/verify"), {
      method: "POST",
      headers: headers(null, { "Content-Type": "application/json" }),
      body: JSON.stringify({ token_hash: verification.tokenHash, type: verification.type }),
    });
    if (!response.ok) throw new Error("登录链接已失效或已被使用，请重新发送登录链接。");

    const session = await response.json();
    if (!session.access_token || !session.refresh_token) {
      throw new Error("登录链接未返回有效会话，请重新发送登录链接。");
    }
    saveSession({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      email: session.user?.email || "",
      userId: session.user?.id || userIdFromToken(session.access_token),
    });
    clearEmailVerificationParams();
    return true;
  }

  async function syncNow() {
    const session = loadSession();
    if (!configured()) throw new Error("云端服务尚未配置。");
    if (!session?.accessToken || !session.userId) throw new Error("请先登录账户。");

    const timestamp = new Date().toISOString();
    const payload = {
      user_id: session.userId,
      snapshot: storageSnapshot(),
      client_updated_at: timestamp,
      schema_version: 1,
    };
    const response = await fetch(api(`/rest/v1/${backupTable}?on_conflict=user_id`), {
      method: "POST",
      headers: headers(session.accessToken, {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      }),
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("云端备份失败，请检查网络后重试。");
    localStorage.setItem(stateKey, JSON.stringify({ lastSyncedAt: timestamp }));
  }

  async function pullLatest() {
    const session = loadSession();
    if (!configured() || !session?.accessToken || !session.userId) return false;
    const response = await fetch(api(`/rest/v1/${backupTable}?user_id=eq.${encodeURIComponent(session.userId)}&select=snapshot,client_updated_at`), {
      headers: headers(session.accessToken),
    });
    if (!response.ok) return false;
    const [remote] = await response.json();
    const localState = JSON.parse(localStorage.getItem(stateKey) || "{}");
    if (remote?.snapshot && (!localState.lastSyncedAt || remote.client_updated_at > localState.lastSyncedAt)) {
      restoreSnapshot(remote.snapshot);
      localStorage.setItem(stateKey, JSON.stringify({ lastSyncedAt: remote.client_updated_at }));
      return true;
    }
    return false;
  }

  async function recordConsent() {
    const session = loadSession();
    if (!configured() || !session?.accessToken || !session?.userId) return;
    const consentRows = ["privacy", "health_data"].map((consent_type) => ({
      user_id: session.userId,
      consent_type,
      policy_version: "2026-09-15",
    }));
    await fetch(api("/rest/v1/user_consents?on_conflict=user_id,consent_type,policy_version"), {
      method: "POST",
      headers: headers(session.accessToken, {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(consentRows),
    });
  }

  async function deleteAccount() {
    const session = loadSession();
    if (!configured() || !session?.accessToken) throw new Error("请先登录账户。");
    const response = await fetch(api("/functions/v1/delete-account"), {
      method: "POST",
      headers: headers(session.accessToken, { "Content-Type": "application/json" }),
      body: "{}",
    });
    if (!response.ok) throw new Error("账户删除未完成，请稍后重试或联系支持人员。");
    clearLocalFitLogData();
  }

  function renderAccount() {
    const session = loadSession();
    const signedIn = Boolean(session?.accessToken && session?.userId);
    const signedOut = document.querySelector("#accountSignedOut");
    const signedInPanel = document.querySelector("#accountSignedIn");
    const state = document.querySelector("#accountState");
    const email = document.querySelector("#accountEmailValue");
    if (!signedOut || !signedInPanel || !state || !email) return;
    signedOut.hidden = signedIn;
    signedInPanel.hidden = !signedIn;
    state.textContent = signedIn
      ? "已登录。训练计划、记录与评估数据会加密传输后备份到你的账户。"
      : configured() ? "登录后即可备份数据并在新设备恢复。" : "当前为离线模式，数据仅保存在此设备。";
    email.textContent = session?.email || "已登录账户";
  }

  function setMessage(message) {
    const target = document.querySelector("#accountMessage");
    if (target) target.textContent = message;
  }

  function bindUi() {
    const dialog = document.querySelector("#accountDialog");
    document.querySelector("#accountButton")?.addEventListener("click", () => dialog?.showModal());
    document.querySelector("#accountSendLink")?.addEventListener("click", async () => {
      const email = document.querySelector("#accountEmail")?.value.trim();
      if (!email) return setMessage("请输入有效邮箱。");
      if (!document.querySelector("#accountConsent")?.checked) return setMessage("请先阅读并同意隐私政策。");
      setMessage("正在发送登录链接…");
      try {
        await requestMagicLink(email);
        setMessage("登录链接已发送，请在邮箱中打开。");
      } catch (error) {
        setMessage(error.message || "操作失败，请稍后重试。");
      }
    });
    document.querySelector("#accountSyncNow")?.addEventListener("click", async () => {
      setMessage("正在同步…");
      try {
        await syncNow();
        setMessage("已完成云端备份。");
      } catch (error) {
        setMessage(error.message || "同步失败，请稍后重试。");
      }
    });
    document.querySelector("#accountSignOut")?.addEventListener("click", () => {
      clearSession();
      renderAccount();
      setMessage("已退出账户；此设备上的本地训练数据仍会保留。");
    });
    document.querySelector("#accountDelete")?.addEventListener("click", async () => {
      if (!window.confirm("删除后将无法恢复云端训练数据。确定继续吗？")) return;
      setMessage("正在删除账户与云端数据…");
      try {
        await deleteAccount();
        renderAccount();
        setMessage("账户与云端数据已删除，本机数据也已清除。");
      } catch (error) {
        setMessage(error.message || "删除失败，请稍后重试。");
      }
    });
    window.addEventListener("online", () => syncNow().catch(() => {}));
    window.addEventListener("pagehide", () => syncNow().catch(() => {}));
  }

  window.FitLogSync = {
    async init() {
      let signedInFromLink = captureHashSession();
      bindUi();
      renderAccount();
      window.Capacitor?.Plugins?.App?.addListener?.("appUrlOpen", async ({ url }) => {
        try {
          if (captureHashSession(url) || await verifyEmailToken(url)) window.location.reload();
        } catch (error) {
          setMessage(error.message || "登录未完成，请重新发送登录链接。");
        }
      });
      if (!signedInFromLink) {
        try {
          signedInFromLink = await verifyEmailToken();
        } catch (error) {
          setMessage(error.message || "登录未完成，请重新发送登录链接。");
        }
      }
      renderAccount();
      if (signedInFromLink) {
        setMessage("登录成功，正在恢复最新训练数据…");
        recordConsent().catch(() => {});
        pullLatest().then((restored) => {
          if (restored) window.location.reload();
          else syncNow().then(() => setMessage("登录成功，已完成首次备份。")).catch(() => {});
        });
      } else if (loadSession()?.accessToken) {
        pullLatest().then((restored) => {
          if (restored) window.location.reload();
        });
      }
    },
    syncNow,
    pullLatest,
    deleteAccount,
    isConfigured: configured,
  };
})();
