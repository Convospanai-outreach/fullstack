// CraftMyFunnel Chrome Extension V1 approval scope.
//
// Permissions stay minimal in manifest.json:
// - storage: local user-approved lead prep data
// - activeTab: popup-initiated capture on the current tab
// - LinkedIn profile host only: content script visibility on profile pages
//
// This worker does not crawl LinkedIn, read credentials, collect session data,
// schedule LinkedIn jobs, or automate outreach.
const CMF_FEATURES = {
  visibleProfileCapture: true,
  linkedinApiCapture: false,
  backendLeadSync: false,
  outreachAutomation: false,
  messageDrafting: false,
  connectionAutomation: false
};

const DEFAULT_STATE = {
  latestCapture: null,
  leadNotes: {
    company: "",
    role: "",
    location: "",
    industry: "",
    notes: "",
    priority: "Medium",
    leadType: "Founder"
  },
  outreachAngle: "Sales introduction",
  customAngle: "",
  draft: {
    tone: "Friendly",
    channel: "LinkedIn DM",
    cta: "Reply if relevant",
    customCta: "",
    message: ""
  },
  qualification: {
    fitScore: 3,
    need: "Unknown",
    timing: "Unknown",
    status: "Captured"
  },
  settings: {
    workspaceUrl: "",
    extensionKey: "",
    syncToken: "",
    defaultTone: "Friendly",
    defaultOutreachAngle: "Sales introduction"
  },
  savedLead: null,
  captureCount: 0,
  activityLog: []
};

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getState();
  await chrome.storage.local.set(state);
  updateBadge(state.captureCount || 0);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "CMF_GET_V1_STATE" || msg?.type === "CMF_GET_LAST_CAPTURE") {
    getState().then((state) => sendResponse({ ok: true, ...state, features: CMF_FEATURES }));
    return true;
  }

  if (msg?.type === "CMF_STORE_VISIBLE_PROFILE") {
    storeVisibleProfile(msg.profile).then(sendResponse);
    return true;
  }

  if (msg?.type === "CMF_UPDATE_ASSISTANT_STATE") {
    updateAssistantState(msg.patch || {}).then(sendResponse);
    return true;
  }

  if (msg?.type === "CMF_SAVE_PREPARED_LEAD") {
    savePreparedLead(msg.payload || {}).then(sendResponse);
    return true;
  }

  if (msg?.type === "CMF_MARK_LINKEDIN_OUTREACH_DONE") {
    markLinkedInOutreachDone(msg.leadId, msg.notes || "").then(sendResponse);
    return true;
  }

  if (msg?.type === "CMF_CLEAR_LOCAL_DATA") {
    clearLocalData().then(sendResponse);
    return true;
  }

  if (msg?.type === "CMF_V2_API_CAPTURE_DISABLED") {
    sendResponse({
      ok: false,
      disabled: true,
      message: "LinkedIn API-assisted capture is prepared but disabled in V1 approval build."
    });
    return false;
  }

  if (msg?.type === "CMF_GET_FEATURES") {
    sendResponse(CMF_FEATURES);
    return false;
  }

  return false;
});

async function getState() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
  return {
    ...DEFAULT_STATE,
    ...stored,
    leadNotes: { ...DEFAULT_STATE.leadNotes, ...(stored.leadNotes || {}) },
    draft: { ...DEFAULT_STATE.draft, ...(stored.draft || {}) },
    qualification: { ...DEFAULT_STATE.qualification, ...(stored.qualification || {}) },
    settings: { ...DEFAULT_STATE.settings, ...(stored.settings || {}) },
    activityLog: (stored.activityLog || []).slice(0, 5)
  };
}

async function storeVisibleProfile(profile = {}) {
  const cleaned = {
    source: "linkedin",
    profileUrl: String(profile.profileUrl || ""),
    name: String(profile.name || ""),
    headline: String(profile.headline || ""),
    currentCompany: String(profile.currentCompany || profile.companyName || profile.company || ""),
    companyName: String(profile.currentCompany || profile.companyName || profile.company || ""),
    company: String(profile.currentCompany || profile.companyName || profile.company || ""),
    location: String(profile.location || ""),
    currentRole: String(profile.currentRole || ""),
    confidence: profile.confidence || {},
    sources: profile.sources || {},
    debug: profile.debug || {},
    capturedAt: new Date().toISOString()
  };

  if (!isLinkedInProfileUrl(cleaned.profileUrl) || !cleaned.name) {
    return { ok: false, error: "Open a LinkedIn profile page to capture a lead." };
  }

  const state = await getState();
  const captureCount = Number(state.captureCount || 0) + 1;
  const activityLog = addActivity(state.activityLog, `Captured profile: ${cleaned.name}`);

  await chrome.storage.local.set({
    latestCapture: cleaned,
    captureCount,
    activityLog
  });
  updateBadge(captureCount);
  return { ok: true, profile: cleaned, activityLog };
}

async function updateAssistantState(patch) {
  const state = await getState();
  const next = {
    leadNotes: { ...state.leadNotes, ...(patch.leadNotes || {}) },
    outreachAngle: patch.outreachAngle ?? state.outreachAngle,
    customAngle: patch.customAngle ?? state.customAngle,
    draft: { ...state.draft, ...(patch.draft || {}) },
    qualification: { ...state.qualification, ...(patch.qualification || {}) },
    settings: { ...state.settings, ...(patch.settings || {}) },
    activityLog: patch.activityLog ? patch.activityLog.slice(0, 5) : state.activityLog
  };
  await chrome.storage.local.set(next);
  return { ok: true, ...next };
}

async function savePreparedLead(payload) {
  const state = await getState();
  const lead = {
    source: "linkedin",
    ...payload,
    capturedAt: payload.capturedAt || state.latestCapture?.capturedAt || new Date().toISOString(),
    savedAt: new Date().toISOString()
  };

  const syncResult = await trySyncLead(lead, state.settings);
  const status = syncResult.ok ? "synced" : "pending_sync";
  const activityLog = addActivity(
    state.activityLog,
    syncResult.ok ? "Lead synced to workspace" : "Lead saved locally"
  );

  await chrome.storage.local.set({
    savedLead: { ...lead, status, leadId: syncResult.leadId || state.savedLead?.leadId || "", syncError: syncResult.error || "" },
    activityLog
  });

  return {
    ok: true,
    synced: syncResult.ok,
    leadId: syncResult.leadId || "",
    matchedExisting: Boolean(syncResult.matchedExisting),
    status,
    message: syncResult.ok
      ? "Synced to CraftMyFunnel workspace."
      : "Pending Sync. Saved locally until CraftMyFunnel is reachable.",
    error: syncResult.error || "",
    activityLog
  };
}

async function trySyncLead(lead, settings) {
  const workspaceUrl = String(settings?.workspaceUrl || "").trim().replace(/\/+$/, "");
  if (!workspaceUrl) return { ok: false, error: "Workspace URL not configured." };

  try {
    const response = await fetch(`${workspaceUrl}/api/extension/leads/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(settings.syncToken ? { Authorization: `Bearer ${settings.syncToken}` } : {}),
        ...(settings.extensionKey ? { "x-extension-key": settings.extensionKey } : {})
      },
      body: JSON.stringify({
        ...lead,
        source: "chrome_extension",
        channel: "LINKEDIN",
        linkedinUrl: lead.profileUrl || lead.linkedinUrl
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) return { ok: false, error: data.error || `Workspace returned ${response.status}.` };
    return { ok: true, leadId: data.leadId || "", matchedExisting: Boolean(data.matchedExisting) };
  } catch (error) {
    return { ok: false, error: error?.message || "Workspace unavailable." };
  }
}

async function markLinkedInOutreachDone(leadId, notes) {
  const state = await getState();
  const workspaceUrl = String(state.settings?.workspaceUrl || "").trim().replace(/\/+$/, "");
  const resolvedLeadId = leadId || state.savedLead?.leadId;
  if (!workspaceUrl || !state.settings?.syncToken || !state.settings?.extensionKey || !resolvedLeadId) {
    return { ok: false, error: "Sync the lead before marking LinkedIn outreach done." };
  }

  try {
    const response = await fetch(`${workspaceUrl}/api/extension/leads/${resolvedLeadId}/linkedin-contacted`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.settings.syncToken}`,
        "x-extension-key": state.settings.extensionKey
      },
      body: JSON.stringify({ notes })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
      return { ok: false, error: data.error || `Workspace returned ${response.status}.` };
    }
    const activityLog = addActivity(state.activityLog, "LinkedIn outreach marked as done");
    await chrome.storage.local.set({
      savedLead: { ...(state.savedLead || {}), status: "synced", leadId: resolvedLeadId, linkedinStatus: "CONTACTED" },
      activityLog
    });
    return { ok: true, ...data, activityLog };
  } catch (error) {
    return { ok: false, error: error?.message || "Workspace unavailable." };
  }
}

async function clearLocalData() {
  await chrome.storage.local.set(DEFAULT_STATE);
  updateBadge(0);
  return { ok: true, ...DEFAULT_STATE };
}

function addActivity(items, message) {
  return [{ at: new Date().toISOString(), message }, ...(items || [])].slice(0, 5);
}

function updateBadge(captureCount) {
  chrome.action.setBadgeText({ text: captureCount ? String(captureCount) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
}

function isLinkedInProfileUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname.endsWith("linkedin.com") && url.pathname.includes("/in/");
  } catch {
    return false;
  }
}

// ===========================================================================
// V2 task-polling worker — ACTIVE ONLY under manifest.v2.json.
//
// This whole block is inert under the V1 approval manifest: V1 grants no
// `alarms` permission, so `chrome.alarms` is undefined, `V2_ENABLED` is false,
// and none of the polling listeners register or fire. It keeps its own flat
// settings (apiBase/token/extensionKey/teamId/pollSeconds/paused) in
// chrome.storage.local, configured by the options page (options.js); the only
// shared key is the namespaced `cmfV2Activity` log, kept separate from V1's.
//
// Scope is assistive, not autonomous: it opens a profile tab, or inserts a draft
// into the LinkedIn composer for the human to review and send. It never clicks
// send/connect. Server producers live in sequenceService.executeLinkedInRun.
// ===========================================================================
const V2_ENABLED = typeof chrome !== "undefined" && typeof chrome.alarms !== "undefined";
const V2_POLL_ALARM = "cmfPollTasks";
const V2_DEFAULT_POLL_SECONDS = 30;
// Pending EXECUTE_TASK dispatches keyed by tabId, persisted to chrome.storage:
// an MV3 service worker can be torn down between opening the tab and the page
// finishing loading, so an in-memory map would lose the task (leaving it claimed
// "processing" server-side, which has no watchdog to reclaim it). Storage
// survives the respawn, and the content script's CMF_CONTENT_READY ping
// re-triggers dispatch if the onUpdated event fired while the worker was dead.
const PENDING_TASKS_KEY = "cmfPendingTasks";

if (V2_ENABLED) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === V2_POLL_ALARM) pollTasks();
  });

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
    if (changeInfo.status !== "complete") return;
    const task = await getPendingTask(tabId);
    if (task) dispatchExecuteTask(tabId, task);
  });

  // Separate listener from the V1 one above (Chrome delivers to every listener).
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Content script announced it is ready on a LinkedIn tab: dispatch any task
    // that was queued for this tab (covers an onUpdated missed while the worker
    // was asleep, and a page reload).
    if (msg?.type === "CMF_CONTENT_READY") {
      const tabId = sender?.tab?.id;
      if (tabId) getPendingTask(tabId).then((task) => { if (task) dispatchExecuteTask(tabId, task); });
      return false;
    }
    if (msg?.type === "ADD_LEAD") {
      const tabId = sender?.tab?.id;
      if (tabId) clearPendingTask(tabId);
      handleLeadCapture(msg.data, msg.taskId).then(sendResponse);
      return true;
    }
    if (msg?.type === "TASK_RESULT") {
      const tabId = sender?.tab?.id;
      if (tabId) clearPendingTask(tabId);
      handleTaskResult(msg.result || {}).then(sendResponse);
      return true;
    }
    if (msg?.type === "LOG_MANUAL_LINKEDIN_ACTION") {
      logManualLinkedInAction(msg.payload || {}, msg.taskId).then(sendResponse);
      return true;
    }
    if (msg?.type === "GET_STATE") {
      getV2State().then(sendResponse);
      return true;
    }
    if (msg?.type === "UPDATE_SETTINGS") {
      updateV2Settings(msg.settings || {}).then(sendResponse);
      return true;
    }
    if (msg?.type === "TOGGLE_PAUSE") {
      setPaused(Boolean(msg.paused)).then(sendResponse);
      return true;
    }
    return false;
  });

  chrome.runtime.onInstalled.addListener(configurePolling);
  if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(configurePolling);
  configurePolling();
}

async function getV2Config() {
  const stored = await chrome.storage.local.get([
    "apiBase", "token", "extensionKey", "teamId", "pollSeconds", "paused"
  ]);
  return {
    apiBase: normalizeApiBase(stored.apiBase || ""),
    extensionKey: stored.extensionKey || "",
    token: stored.token || "",
    teamId: stored.teamId || "",
    pollSeconds: Math.max(15, Number(stored.pollSeconds || V2_DEFAULT_POLL_SECONDS)),
    paused: Boolean(stored.paused)
  };
}

function normalizeApiBase(apiBase) {
  return String(apiBase || "").trim().replace(/\/+$/, "");
}

function v2Headers(cfg) {
  return {
    "Content-Type": "application/json",
    ...(cfg.extensionKey ? { "x-extension-key": cfg.extensionKey } : {}),
    ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
    ...(cfg.teamId ? { "x-team-id": cfg.teamId } : {})
  };
}

async function configurePolling() {
  if (!V2_ENABLED) return;
  const cfg = await getV2Config();
  chrome.alarms.clear(V2_POLL_ALARM, () => {
    // Chrome enforces a 1-minute alarm floor for MV3 service workers.
    const periodInMinutes = Math.max(60, cfg.pollSeconds) / 60;
    chrome.alarms.create(V2_POLL_ALARM, { periodInMinutes });
  });
}

async function pollTasks() {
  const cfg = await getV2Config();
  if (cfg.paused || !cfg.apiBase || !cfg.token) return;

  try {
    const res = await fetch(`${cfg.apiBase}/extension/tasks/pending`, { method: "GET", headers: v2Headers(cfg) });
    if (!res.ok) {
      await addV2Activity(`Task polling failed: ${res.status}`, "error");
      return;
    }
    const data = await res.json().catch(() => ({}));
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    for (const task of tasks) await processTask(task, cfg);
  } catch (error) {
    await addV2Activity(`Task polling error: ${error?.message || error}`, "error");
  }
}

async function processTask(task, cfg) {
  const type = task?.type;
  if (!type) return;
  const payload = task.payload || {};

  if (type === "OPEN_PROFILE") {
    const url = payload.profileUrl || task.profileUrl;
    if (!isLinkedInProfileUrl(url)) {
      await reportTaskResult(task, "ERROR", { error: "OPEN_PROFILE requires a LinkedIn profile URL." });
      return;
    }
    // Await the create + report in the main flow (not inside the create callback):
    // async work started in a torn-down worker's callback may never run.
    await chrome.tabs.create({ url, active: true });
    await reportTaskResult(task, "SUCCESS", { profileUrl: url });
    notify("CraftMyFunnel", "Opened a LinkedIn profile for manual review.");
    return;
  }

  if (type === "LOG_MANUAL_LINKEDIN_ACTION") {
    await logManualLinkedInAction(payload, task.id);
    return;
  }

  if (type === "ADD_LEAD" || type === "INSERT_DRAFT") {
    await sendTaskToLinkedInTab(task);
    return;
  }

  await reportTaskResult(task, "ERROR", { error: `Unsupported task type: ${type}` });
}

async function sendTaskToLinkedInTab(task) {
  const requestedUrl = task.payload?.profileUrl || task.profileUrl;
  const tabs = await chrome.tabs.query(requestedUrl ? {} : { active: true, currentWindow: true });
  const linkedInTabs = (tabs || []).filter((tab) => isLinkedInProfileUrl(tab.url));
  const currentTab = linkedInTabs[0];

  if (currentTab && (!requestedUrl || sameLinkedInProfile(currentTab.url, requestedUrl))) {
    // Collision guard: a batch poll can return several tasks; don't overwrite a
    // task already pending on this tab (the first would be lost with no result).
    const existing = await getPendingTask(currentTab.id);
    if (existing && existing.id !== task.id) {
      await reportTaskResult(task, "ERROR", { error: "Another task is already in progress on this LinkedIn tab." });
      return;
    }
    await setPendingTask(currentTab.id, task);
    dispatchExecuteTask(currentTab.id, task);
    return;
  }

  if (isLinkedInProfileUrl(requestedUrl)) {
    // New tab: persist the task, then let onUpdated / CMF_CONTENT_READY dispatch
    // once the content script is live (the page is still loading here).
    const tab = await chrome.tabs.create({ url: requestedUrl, active: task.type === "INSERT_DRAFT" });
    await setPendingTask(tab.id, task);
    return;
  }

  await reportTaskResult(task, "ERROR", { error: `${task.type} requires an open LinkedIn profile page.` });
}

function dispatchExecuteTask(tabId, task) {
  chrome.tabs.sendMessage(tabId, { type: "EXECUTE_TASK", task }, () => {
    // Content script not ready yet — swallow the connection error; the task stays
    // persisted and its CMF_CONTENT_READY ping (on load) will retry the dispatch.
    void chrome.runtime.lastError;
  });
}

async function getPendingMap() {
  const stored = await chrome.storage.local.get([PENDING_TASKS_KEY]);
  const map = stored[PENDING_TASKS_KEY];
  return map && typeof map === "object" ? map : {};
}

async function setPendingTask(tabId, task) {
  const map = await getPendingMap();
  map[String(tabId)] = task;
  await chrome.storage.local.set({ [PENDING_TASKS_KEY]: map });
}

async function getPendingTask(tabId) {
  const map = await getPendingMap();
  return map[String(tabId)] || null;
}

async function clearPendingTask(tabId) {
  const map = await getPendingMap();
  if (map[String(tabId)]) {
    delete map[String(tabId)];
    await chrome.storage.local.set({ [PENDING_TASKS_KEY]: map });
  }
}

async function handleLeadCapture(data = {}, taskId) {
  const cfg = await getV2Config();
  if (!cfg.apiBase || !cfg.token) {
    return { ok: false, error: "Save CraftMyFunnel settings before adding leads." };
  }

  const payload = {
    teamId: cfg.teamId || undefined,
    source: "linkedin_extension",
    profileUrl: data.profileUrl,
    name: data.name,
    headline: data.headline,
    company: data.company
  };

  try {
    const res = await fetch(`${cfg.apiBase}/extension/leads`, {
      method: "POST",
      headers: v2Headers(cfg),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      await addV2Activity(`Lead add failed: ${errorText || res.status}`, "error");
      if (taskId) await reportTaskResult({ id: taskId, type: "ADD_LEAD" }, "ERROR", { error: errorText });
      return { ok: false, error: errorText || "Lead add failed." };
    }
    const result = await res.json().catch(() => ({}));
    await addV2Activity(`Added lead: ${data.name || data.profileUrl}`, "success");
    notify("CraftMyFunnel", "Lead added for review.");
    if (taskId) await reportTaskResult({ id: taskId, type: "ADD_LEAD" }, "SUCCESS", { lead: result });
    return { ok: true, result };
  } catch (error) {
    await addV2Activity(`Lead add error: ${error?.message || error}`, "error");
    if (taskId) await reportTaskResult({ id: taskId, type: "ADD_LEAD" }, "ERROR", { error: error?.message });
    return { ok: false, error: error?.message };
  }
}

async function handleTaskResult(result = {}) {
  await addV2Activity(`${result.type || "TASK"}: ${result.status || "UNKNOWN"}`, result.status === "SUCCESS" ? "success" : "error");
  await reportTaskResult({ id: result.taskId, type: result.type }, result.status || "ERROR", result);
  return { ok: true };
}

async function logManualLinkedInAction(payload = {}, taskId) {
  const result = {
    taskId,
    type: "LOG_MANUAL_LINKEDIN_ACTION",
    status: "SUCCESS",
    action: payload.action || "LINKEDIN_TASK",
    profileUrl: payload.profileUrl,
    note: payload.note || ""
  };
  await addV2Activity(`Logged manual action: ${result.action}`, "success");
  await reportTaskResult({ id: taskId, type: "LOG_MANUAL_LINKEDIN_ACTION" }, "SUCCESS", result);
  return { ok: true };
}

async function reportTaskResult(task, status, result = {}) {
  if (!task?.id) return;
  const cfg = await getV2Config();
  if (!cfg.apiBase) return;
  try {
    await fetch(`${cfg.apiBase}/extension/tasks/result`, {
      method: "POST",
      headers: v2Headers(cfg),
      body: JSON.stringify({
        taskId: task.id,
        type: task.type,
        status,
        result,
        error: status === "ERROR" ? result.error : undefined,
        teamId: cfg.teamId || undefined
      })
    });
  } catch (error) {
    await addV2Activity(`Result report failed: ${error?.message || error}`, "error");
  }
}

async function updateV2Settings(settings = {}) {
  const patch = {};
  if (settings.apiBase !== undefined) patch.apiBase = normalizeApiBase(settings.apiBase);
  if (settings.token !== undefined) patch.token = settings.token;
  if (settings.extensionKey !== undefined) patch.extensionKey = settings.extensionKey;
  if (settings.teamId !== undefined) patch.teamId = settings.teamId;
  if (settings.pollSeconds !== undefined) patch.pollSeconds = Math.max(15, Number(settings.pollSeconds) || V2_DEFAULT_POLL_SECONDS);
  await chrome.storage.local.set(patch);
  await configurePolling();
  return { ok: true };
}

async function setPaused(paused) {
  await chrome.storage.local.set({ paused });
  await addV2Activity(paused ? "Polling paused" : "Polling resumed", "info");
  return { ok: true, paused };
}

async function getV2State() {
  const cfg = await getV2Config();
  const { cmfV2Activity } = await chrome.storage.local.get(["cmfV2Activity"]);
  return {
    ok: true,
    configured: Boolean(cfg.apiBase && cfg.token),
    apiBase: cfg.apiBase,
    token: cfg.token,
    extensionKey: cfg.extensionKey,
    teamId: cfg.teamId,
    pollSeconds: cfg.pollSeconds,
    paused: cfg.paused,
    activityLog: cmfV2Activity || []
  };
}

async function addV2Activity(message, level = "info") {
  const { cmfV2Activity } = await chrome.storage.local.get(["cmfV2Activity"]);
  const next = [{ message, level, at: new Date().toISOString() }, ...(cmfV2Activity || [])].slice(0, 30);
  await chrome.storage.local.set({ cmfV2Activity: next });
}

function notify(title, message) {
  if (typeof chrome === "undefined" || !chrome.notifications) return;
  chrome.notifications.create({ type: "basic", iconUrl: "icons/icon-48.png", title, message });
}

function sameLinkedInProfile(a, b) {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.pathname.replace(/\/+$/, "") === right.pathname.replace(/\/+$/, "");
  } catch {
    return false;
  }
}
