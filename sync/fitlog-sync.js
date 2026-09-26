(() => {
  const runtime = window.FITLOG_RUNTIME || {};
  const storagePrefix = "fitlog-";
  const sessionKey = "fitlog-sync-session";
  const stateKey = "fitlog-sync-state";
  const backupTable = "user_sync_snapshots";
  const structuredTables = {
    sessions: "workout_sessions",
    exercises: "workout_exercises",
    sets: "workout_sets",
  };
  let pendingEmail = "";

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

  function parseSnapshotJson(snapshot, key, fallback) {
    const raw = snapshot?.[key];
    if (raw === undefined || raw === null) return fallback;
    if (typeof raw !== "string") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function snapshotArray(snapshot, key) {
    const value = parseSnapshotJson(snapshot, key, []);
    return Array.isArray(value) ? value : [];
  }

  function normalizeDate(value, fallback = new Date().toISOString().slice(0, 10)) {
    const match = String(value || "").match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : fallback;
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function positiveInt(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
  }

  function parseRepRange(value) {
    const text = String(value || "");
    const range = text.match(/(\d+)\s*[-~至]\s*(\d+)/);
    if (range) return { min: Number(range[1]), max: Number(range[2]) };
    const single = text.match(/(?:×|x)\s*(\d+)|(\d+)\s*次/);
    const reps = Number(single?.[1] || single?.[2] || 0);
    return reps ? { min: reps, max: reps } : { min: null, max: null };
  }

  function stableHashHex(value, salt) {
    let hash = 0x811c9dc5 ^ salt;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function stableUuid(value) {
    const input = String(value || "fitlog");
    let hex = [0, 1, 2, 3].map((salt) => stableHashHex(input, salt)).join("");
    hex = `${hex.slice(0, 12)}5${hex.slice(13, 16)}${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17)}`;
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function exerciseName(item) {
    return item?.exerciseName || item?.name || item?.nameZh || "训练动作";
  }

  function exerciseClientKey(item, index) {
    return item?.exerciseId || item?.id || exerciseName(item) || `exercise-${index + 1}`;
  }

  function workoutSessionId(userId, clientId) {
    return stableUuid(`workout-session:${userId}:${clientId}`);
  }

  function workoutExerciseId(userId, clientId) {
    return stableUuid(`workout-exercise:${userId}:${clientId}`);
  }

  function workoutSetId(userId, clientId) {
    return stableUuid(`workout-set:${userId}:${clientId}`);
  }

  function buildStructuredTrainingRows(snapshot, userId, migratedAt = new Date().toISOString()) {
    const records = snapshotArray(snapshot, "fitlog-records");
    const trainingSetLogs = snapshotArray(snapshot, "fitlog-training-set-logs");
    const completedPlanDays = new Set(snapshotArray(snapshot, "fitlog-plan-completed").filter(Boolean));
    const sessions = new Map();
    const exercises = new Map();
    const sets = new Map();
    const exerciseSortBySession = new Map();

    function addSession(clientId, row) {
      if (!clientId) return null;
      const id = workoutSessionId(userId, clientId);
      const existing = sessions.get(id) || {};
      sessions.set(id, {
        id,
        user_id: userId,
        client_id: clientId,
        source_snapshot_key: row.source_snapshot_key || "fitlog-records",
        source_snapshot_version: 1,
        performed_on: normalizeDate(row.performed_on || row.date),
        status: row.status || "completed",
        completed_at: row.completed_at || row.completedAt || migratedAt,
        total_volume_kg: numberOrNull(row.total_volume_kg) || numberOrNull(row.totalVolumeKg) || existing.total_volume_kg || 0,
        total_exercise_count: positiveInt(row.total_exercise_count) || positiveInt(row.actions) || existing.total_exercise_count || 0,
        notes: row.notes || row.description || existing.notes || null,
      });
      return id;
    }

    function addExercise(sessionId, sessionClientId, item, index, sourceKey = "fitlog-records") {
      if (!sessionId) return null;
      const sortOrder = index + 1;
      const clientId = `${sessionClientId}:exercise:${exerciseClientKey(item, index)}`;
      const id = workoutExerciseId(userId, clientId);
      const reps = parseRepRange(item?.prescription || item?.plannedReps || item?.reps);
      exercises.set(id, {
        id,
        workout_session_id: sessionId,
        client_id: clientId,
        source_snapshot_key: sourceKey,
        source_snapshot_version: 1,
        exercise_id: item?.exerciseId || item?.id || null,
        exercise_name_snapshot: exerciseName(item),
        phase: "main",
        sort_order: sortOrder,
        planned_sets: positiveInt(item?.sets),
        planned_rep_min: reps.min,
        planned_rep_max: reps.max,
        planned_rm_target: item?.rm || item?.rmTarget || null,
      });
      return id;
    }

    function addLogSet(workoutExerciseIdValue, log, setNumber, sourceKey = "fitlog-training-set-logs") {
      if (!workoutExerciseIdValue || !setNumber) return;
      const clientId = `${log.id || `${log.planDayId || log.date}-${log.exerciseId || log.exerciseName}`}:set:${setNumber}`;
      const id = workoutSetId(userId, clientId);
      sets.set(id, {
        id,
        workout_exercise_id: workoutExerciseIdValue,
        client_id: clientId,
        source_snapshot_key: sourceKey,
        source_snapshot_version: 1,
        set_number: setNumber,
        weight_kg: numberOrNull(log.weightKg),
        reps: positiveInt(log.reps || log.plannedReps),
        rm_actual: log.rmActual || null,
        rest_seconds: positiveInt(log.restSeconds),
        completed: true,
      });
    }

    function findExercise(sessionId, exerciseKey, name) {
      return Array.from(exercises.values()).find((row) =>
        row.workout_session_id === sessionId
        && (row.exercise_id === exerciseKey || row.exercise_name_snapshot === name)
      )?.id || null;
    }

    function nextExerciseIndex(sessionId) {
      return Array.from(exercises.values()).filter((row) => row.workout_session_id === sessionId).length;
    }

    records
      .filter((record) => record && (record.source === "plan" || record.planDayId || record.exercises))
      .forEach((record) => {
        const sessionClientId = `plan:${record.planDayId || record.id}`;
        const sessionId = addSession(sessionClientId, {
          ...record,
          status: completedPlanDays.has(record.planDayId) || record.completedAt ? "completed" : "scheduled",
          source_snapshot_key: "fitlog-records",
        });
        const recordExercises = Array.isArray(record.exercises) ? record.exercises : [];
        recordExercises.forEach((exercise, index) => {
          addExercise(sessionId, sessionClientId, { ...exercise, rm: record.rm }, index, "fitlog-records");
        });
      });

    const planLogGroups = new Map();
    const manualLogGroups = new Map();
    trainingSetLogs.forEach((log) => {
      if (!log || typeof log !== "object") return;
      if (log.source === "plan" && log.planDayId) {
        const key = `plan:${log.planDayId}`;
        if (!planLogGroups.has(key)) planLogGroups.set(key, []);
        planLogGroups.get(key).push(log);
      } else {
        const key = `manual:${normalizeDate(log.date)}`;
        if (!manualLogGroups.has(key)) manualLogGroups.set(key, []);
        manualLogGroups.get(key).push(log);
      }
    });

    planLogGroups.forEach((logs, sessionClientId) => {
      const first = logs[0] || {};
      const sessionId = addSession(sessionClientId, {
        date: first.date,
        completedAt: first.completedAt || first.createdAt,
        source_snapshot_key: "fitlog-training-set-logs",
        total_exercise_count: new Set(logs.map((log) => log.exerciseId || log.exerciseName)).size,
        total_volume_kg: logs.reduce((sum, log) => {
          const setsCount = positiveInt(log.sets) || 1;
          return sum + (numberOrNull(log.weightKg) || 0) * (positiveInt(log.reps || log.plannedReps) || 0) * setsCount;
        }, 0),
        notes: first.notes || "Snapshot 训练记录迁移",
      });
      logs.forEach((log, index) => {
        const exerciseKey = exerciseClientKey(log, index);
        const exerciseId = findExercise(sessionId, exerciseKey, exerciseName(log))
          || addExercise(sessionId, sessionClientId, { ...log, sets: log.sets || 1 }, nextExerciseIndex(sessionId), "fitlog-training-set-logs");
        const setCount = positiveInt(log.sets) || 1;
        for (let setNumber = 1; setNumber <= setCount; setNumber += 1) addLogSet(exerciseId, log, setNumber);
      });
    });

    manualLogGroups.forEach((logs, sessionClientId) => {
      const first = logs[0] || {};
      const usedSetNumbers = new Map();
      const sessionId = addSession(sessionClientId, {
        date: first.date,
        completedAt: first.createdAt,
        source_snapshot_key: "fitlog-training-set-logs",
        total_exercise_count: new Set(logs.map((log) => log.exerciseId || log.exerciseName)).size,
        total_volume_kg: logs.reduce((sum, log) => sum + (numberOrNull(log.weightKg) || 0) * (positiveInt(log.reps) || 0), 0),
        notes: "手动训练组记录",
      });
      logs.forEach((log, index) => {
        const exerciseKey = exerciseClientKey(log, index);
        const sessionExerciseKey = `${sessionClientId}:exercise:${exerciseKey}`;
        if (!exerciseSortBySession.has(sessionExerciseKey)) exerciseSortBySession.set(sessionExerciseKey, nextExerciseIndex(sessionId));
        const exerciseId = findExercise(sessionId, exerciseKey, exerciseName(log))
          || addExercise(sessionId, sessionClientId, { ...log, sets: 1 }, exerciseSortBySession.get(sessionExerciseKey), "fitlog-training-set-logs");
        const used = usedSetNumbers.get(exerciseId) || new Set();
        let setNumber = positiveInt(log.setNumber) || logs.filter((item, itemIndex) =>
          itemIndex <= index && exerciseClientKey(item, itemIndex) === exerciseKey
        ).length;
        while (used.has(setNumber)) setNumber += 1;
        used.add(setNumber);
        usedSetNumbers.set(exerciseId, used);
        addLogSet(exerciseId, log, setNumber);
      });
    });

    return {
      sessions: Array.from(sessions.values()),
      exercises: Array.from(exercises.values()),
      sets: Array.from(sets.values()),
    };
  }

  function headers(token, extra = {}) {
    return {
      apikey: runtime.supabaseAnonKey,
      Authorization: `Bearer ${token || runtime.supabaseAnonKey}`,
      ...extra,
    };
  }

  async function requestEmailOtp(email) {
    if (!configured()) throw new Error("云端服务尚未配置，请联系管理员。");
    const response = await fetch(api("/auth/v1/otp"), {
      method: "POST",
      headers: headers(null, { "Content-Type": "application/json" }),
      body: JSON.stringify({ email, create_user: true }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      const detail = errorBody?.msg || errorBody?.message || errorBody?.error_description;
      throw new Error(detail ? `验证码发送失败：${String(detail).slice(0, 160)}` : "验证码发送失败，请稍后重试。");
    }
  }

  async function verifyEmailOtp(email, token) {
    if (!configured()) throw new Error("云端服务尚未配置，请联系管理员。");
    const response = await fetch(api("/auth/v1/verify"), {
      method: "POST",
      headers: headers(null, { "Content-Type": "application/json" }),
      body: JSON.stringify({ email, token, type: "email" }),
    });
    if (!response.ok) throw new Error("验证码错误或已过期，请重新发送验证码。");

    const session = await response.json();
    if (!session.access_token || !session.refresh_token) {
      throw new Error("验证码未返回有效会话，请重新发送验证码。");
    }
    saveSession({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      email: session.user?.email || email,
      userId: session.user?.id || userIdFromToken(session.access_token),
    });
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
    if (!response.ok) throw new Error("登录链接已失效或已被使用，请改用邮箱验证码重新登录。");

    const session = await response.json();
    if (!session.access_token || !session.refresh_token) {
      throw new Error("登录链接未返回有效会话，请改用邮箱验证码重新登录。");
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

  async function completeSignIn() {
    pendingEmail = "";
    setOtpStep(false);
    renderAccount();
    setMessage("登录成功，正在恢复最新训练数据…");
    recordConsent().catch(() => {});
    const restored = await pullLatest();
    if (restored) {
      window.location.reload();
      return;
    }
    await syncNow();
    setMessage("登录成功，已完成首次备份。");
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
    const structuredSynced = await syncStructuredTraining(session, payload.snapshot, timestamp).catch(() => false);
    localStorage.setItem(stateKey, JSON.stringify({
      lastSyncedAt: timestamp,
      structuredTrainingSyncedAt: structuredSynced ? timestamp : undefined,
    }));
  }

  async function upsertStructuredRows(session, table, rows) {
    if (!rows.length) return true;
    const response = await fetch(api(`/rest/v1/${table}?on_conflict=id`), {
      method: "POST",
      headers: headers(session.accessToken, {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(rows),
    });
    if (!response.ok) throw new Error(`Structured sync failed for ${table}`);
    return true;
  }

  async function syncStructuredTraining(session, snapshot = storageSnapshot(), timestamp = new Date().toISOString()) {
    if (!session?.accessToken || !session?.userId) return false;
    const rows = buildStructuredTrainingRows(snapshot, session.userId, timestamp);
    if (!rows.sessions.length && !rows.exercises.length && !rows.sets.length) return false;
    await upsertStructuredRows(session, structuredTables.sessions, rows.sessions);
    await upsertStructuredRows(session, structuredTables.exercises, rows.exercises);
    await upsertStructuredRows(session, structuredTables.sets, rows.sets);
    return true;
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
      await syncStructuredTraining(session, storageSnapshot(), remote.client_updated_at).catch(() => false);
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

  function setOtpStep(active) {
    const emailInput = document.querySelector("#accountEmail");
    const consent = document.querySelector("#accountConsent");
    const sendButton = document.querySelector("#accountSendCode");
    const otpStep = document.querySelector("#accountOtpStep");
    const otpInput = document.querySelector("#accountOtp");
    if (emailInput) emailInput.disabled = active;
    if (consent) consent.disabled = active;
    if (sendButton) sendButton.hidden = active;
    if (otpStep) otpStep.hidden = !active;
    if (otpInput && !active) otpInput.value = "";
    if (active) otpInput?.focus();
  }

  function bindUi() {
    const dialog = document.querySelector("#accountDialog");
    document.querySelector("#accountButton")?.addEventListener("click", () => dialog?.showModal());
    document.querySelector("#accountSendCode")?.addEventListener("click", async () => {
      const email = document.querySelector("#accountEmail")?.value.trim().toLowerCase();
      if (!email) return setMessage("请输入有效邮箱。");
      if (!document.querySelector("#accountConsent")?.checked) return setMessage("请先阅读并同意隐私政策。");
      if (!configured()) return setMessage("云端服务尚未配置，请联系管理员。");
      pendingEmail = email;
      setOtpStep(true);
      setMessage("正在发送验证码…");
      try {
        await requestEmailOtp(email);
        setMessage("验证码已发送，请查看邮箱并在此输入。");
      } catch (error) {
        setMessage(error.message || "操作失败，请稍后重试。");
      }
    });
    document.querySelector("#accountVerifyCode")?.addEventListener("click", async () => {
      const email = pendingEmail || document.querySelector("#accountEmail")?.value.trim().toLowerCase();
      const token = document.querySelector("#accountOtp")?.value.replace(/\s/g, "");
      if (!email) return setMessage("请先填写邮箱并发送验证码。");
      if (!/^\d{6}$/.test(token || "")) return setMessage("请输入邮件中的 6 位验证码。");
      setMessage("正在验证验证码…");
      try {
        await verifyEmailOtp(email, token);
        await completeSignIn();
      } catch (error) {
        setMessage(error.message || "登录失败，请稍后重试。");
      }
    });
    document.querySelector("#accountChangeEmail")?.addEventListener("click", () => {
      pendingEmail = "";
      setOtpStep(false);
      setMessage("可重新填写邮箱并获取验证码。");
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
          setMessage(error.message || "登录未完成，请改用邮箱验证码重新登录。");
        }
      });
      if (!signedInFromLink) {
        try {
          signedInFromLink = await verifyEmailToken();
        } catch (error) {
          setMessage(error.message || "登录未完成，请改用邮箱验证码重新登录。");
        }
      }
      renderAccount();
      if (signedInFromLink) {
        completeSignIn().catch((error) => setMessage(error.message || "登录后的同步未完成，请稍后重试。"));
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
    __private: {
      buildStructuredTrainingRows,
      stableUuid,
    },
  };
})();
