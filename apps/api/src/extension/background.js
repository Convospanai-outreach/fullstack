const DEFAULT_API_BASE = "http://localhost:3000/api";
const DEFAULT_POLL_SECONDS = 30;
const EXTENSION_KEY = "cmf-extension";

let state = {
  token: null,
  teamId: null,
  extensionKey: "",
  apiBase: DEFAULT_API_BASE,
  paused: false,
  pollSeconds: DEFAULT_POLL_SECONDS,
  stats: {
    leadsAdded: 0,
    draftsInserted: 0,
    tasksCompleted: 0,
    errors: 0
  },
  activityLog: []
};

const pendingTasksByTabId = {};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get([
    "token",
    "teamId",
    "extensionKey",
    "apiBase",
    "paused",
    "pollSeconds",
    "stats",
    "activityLog"
  ]);

  state = { ...state, ...stored };
  await chrome.storage.local.set({
    apiBase: state.apiBase || DEFAULT_API_BASE,
    pollSeconds: state.pollSeconds || DEFAULT_POLL_SECONDS,
    paused: Boolean(state.paused),
    stats: state.stats,
    activityLog: state.activityLog
  });

  configurePolling();
  updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await hydrateState();
  configurePolling();
  updateBadge();
});

hydrateState();
configurePolling();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pollTasks") {
    pollTasks();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "complete" || !pendingTasksByTabId[tabId]) return;

  const task = pendingTasksByTabId[tabId];
  chrome.tabs.sendMessage(tabId, { type: "EXECUTE_TASK", task }, () => {
    if (chrome.runtime.lastError) {
      reportTaskResult(task, "ERROR", {
        error: "LinkedIn content script was not available on this page."
      });
      delete pendingTasksByTabId[tabId];
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "ADD_LEAD") {
    if (sender?.tab?.id && pendingTasksByTabId[sender.tab.id]) {
      delete pendingTasksByTabId[sender.tab.id];
    }
    handleLeadCapture(msg.data, msg.taskId).then(sendResponse);
    return true;
  }

  if (msg.type === "TASK_RESULT") {
    const tabId = sender?.tab?.id;
    if (tabId && pendingTasksByTabId[tabId]) {
      delete pendingTasksByTabId[tabId];
    }
    handleTaskResult(msg.result).then(sendResponse);
    return true;
  }

  if (msg.type === "LOG_MANUAL_LINKEDIN_ACTION") {
    logManualLinkedInAction(msg.payload).then(sendResponse);
    return true;
  }

  if (msg.type === "GET_STATE") {
    sendResponse({
      token: state.token,
      teamId: state.teamId,
      extensionKey: state.extensionKey,
      apiBase: state.apiBase,
      paused: state.paused,
      pollSeconds: state.pollSeconds,
      stats: state.stats,
      activityLog: state.activityLog
    });
    return false;
  }

  if (msg.type === "UPDATE_SETTINGS") {
    updateSettings(msg.settings).then(sendResponse);
    return true;
  }

  if (msg.type === "TOGGLE_PAUSE") {
    setPaused(Boolean(msg.paused)).then(sendResponse);
    return true;
  }
});

async function hydrateState() {
  const stored = await chrome.storage.local.get([
    "token",
    "teamId",
    "extensionKey",
    "apiBase",
    "paused",
    "pollSeconds",
    "stats",
    "activityLog"
  ]);

  state = {
    ...state,
    ...stored,
    apiBase: normalizeApiBase(stored.apiBase || DEFAULT_API_BASE),
    pollSeconds: Number(stored.pollSeconds || DEFAULT_POLL_SECONDS)
  };
}

function configurePolling() {
  chrome.alarms.clear("pollTasks", () => {
    const periodInMinutes = Math.max(15, state.pollSeconds || DEFAULT_POLL_SECONDS) / 60;
    chrome.alarms.create("pollTasks", { periodInMinutes });
  });
}

function headers() {
  return {
    "Content-Type": "application/json",
    "x-extension-key": state.extensionKey || EXTENSION_KEY,
    "Authorization": state.token ? `Bearer ${state.token}` : "",
    "x-team-id": state.teamId || ""
  };
}

function normalizeApiBase(apiBase) {
  return (apiBase || DEFAULT_API_BASE).replace(/\/+$/, "");
}

async function pollTasks() {
  await hydrateState();
  if (state.paused || !state.token) {
    updateBadge();
    return;
  }

  try {
    const res = await fetch(`${state.apiBase}/extension/tasks/pending`, {
      method: "GET",
      headers: headers()
    });

    if (!res.ok) {
      await addActivity("Task polling failed", "error");
      incrementStat("errors");
      return;
    }

    const data = await res.json();
    const tasks = Array.isArray(data.tasks) ? data.tasks : [];
    for (const task of tasks) {
      await processTask(task);
    }
  } catch (error) {
    await addActivity(`Task polling error: ${error.message}`, "error");
    incrementStat("errors");
  }
}

async function processTask(task) {
  if (!task?.type) return;

  if (task.type === "OPEN_PROFILE") {
    const url = task.payload?.profileUrl || task.profileUrl;
    if (!isLinkedInUrl(url)) {
      await reportTaskResult(task, "ERROR", { error: "OPEN_PROFILE requires a LinkedIn profile URL." });
      return;
    }
    chrome.tabs.create({ url, active: true }, async () => {
      await reportTaskResult(task, "SUCCESS", { profileUrl: url });
      notify("CraftMyFunnel task", "Opened LinkedIn profile for manual review.");
    });
    return;
  }

  if (task.type === "LOG_MANUAL_LINKEDIN_ACTION") {
    await logManualLinkedInAction(task.payload || {}, task.id);
    return;
  }

  if (task.type === "ADD_LEAD" || task.type === "INSERT_DRAFT") {
    await sendTaskToLinkedInTab(task);
    return;
  }

  await reportTaskResult(task, "ERROR", { error: `Unsupported task type: ${task.type}` });
}

async function sendTaskToLinkedInTab(task) {
  const requestedUrl = task.payload?.profileUrl || task.profileUrl;
  const query = requestedUrl ? {} : { active: true, currentWindow: true };

  chrome.tabs.query(query, (tabs) => {
    const linkedInTabs = tabs.filter((tab) => isLinkedInUrl(tab.url));
    const currentTab = linkedInTabs[0];

    if (currentTab && (!requestedUrl || sameLinkedInProfile(currentTab.url, requestedUrl))) {
      pendingTasksByTabId[currentTab.id] = task;
      chrome.tabs.sendMessage(currentTab.id, { type: "EXECUTE_TASK", task }, async () => {
        if (chrome.runtime.lastError) {
          await reportTaskResult(task, "ERROR", {
            error: "Refresh the LinkedIn page and try again."
          });
          delete pendingTasksByTabId[currentTab.id];
        }
      });
      return;
    }

    if (isLinkedInUrl(requestedUrl)) {
      chrome.tabs.create({ url: requestedUrl, active: task.type === "INSERT_DRAFT" }, (tab) => {
        pendingTasksByTabId[tab.id] = task;
      });
      return;
    }

    reportTaskResult(task, "ERROR", {
      error: `${task.type} requires an open LinkedIn profile page.`
    });
  });
}

async function handleLeadCapture(data, taskId) {
  if (!state.token) {
    return { ok: false, error: "Save CraftMyFunnel settings before adding leads." };
  }

  const payload = {
    teamId: state.teamId || undefined,
    source: "linkedin_extension",
    profileUrl: data.profileUrl,
    name: data.name,
    headline: data.headline,
    company: data.company
  };

  try {
    const res = await fetch(`${state.apiBase}/extension/leads`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorText = await safeResponseText(res);
      incrementStat("errors");
      await addActivity(`Lead add failed: ${errorText || res.status}`, "error");
      if (taskId) await reportTaskResult({ id: taskId, type: "ADD_LEAD" }, "ERROR", { error: errorText });
      return { ok: false, error: errorText || "Lead add failed." };
    }

    const result = await safeJson(res);
    incrementStat("leadsAdded");
    await addActivity(`Added lead: ${data.name || data.profileUrl}`, "success");
    notify("CraftMyFunnel", "Lead added for review.");
    if (taskId) await reportTaskResult({ id: taskId, type: "ADD_LEAD" }, "SUCCESS", { lead: result, ...payload });
    return { ok: true, result };
  } catch (error) {
    incrementStat("errors");
    await addActivity(`Lead add error: ${error.message}`, "error");
    if (taskId) await reportTaskResult({ id: taskId, type: "ADD_LEAD" }, "ERROR", { error: error.message });
    return { ok: false, error: error.message };
  }
}

async function handleTaskResult(result) {
  if (result.status === "SUCCESS") {
    incrementStat("tasksCompleted");
    if (result.type === "INSERT_DRAFT") incrementStat("draftsInserted");
  } else {
    incrementStat("errors");
  }

  await addActivity(`${result.type}: ${result.status}`, result.status === "SUCCESS" ? "success" : "error");
  await reportTaskResult({ id: result.taskId, type: result.type }, result.status, result);
  return { ok: true };
}

async function logManualLinkedInAction(payload, taskId) {
  const result = {
    taskId,
    type: "LOG_MANUAL_LINKEDIN_ACTION",
    status: "SUCCESS",
    action: payload.action || "LINKEDIN_TASK",
    profileUrl: payload.profileUrl,
    note: payload.note || ""
  };

  await addActivity(`Logged manual action: ${result.action}`, "success");
  if (taskId) {
    await reportTaskResult({ id: taskId, type: "LOG_MANUAL_LINKEDIN_ACTION" }, "SUCCESS", result);
  } else {
    await fetch(`${state.apiBase}/extension/tasks/result`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ ...result, teamId: state.teamId || undefined })
    }).catch(() => incrementStat("errors"));
  }
  return { ok: true };
}

async function reportTaskResult(task, status, result = {}) {
  if (!task?.id) return;

  try {
    await fetch(`${state.apiBase}/extension/tasks/result`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        taskId: task.id,
        type: task.type,
        status,
        result,
        error: status === "ERROR" ? result.error : undefined,
        teamId: state.teamId || undefined
      })
    });
  } catch (error) {
    incrementStat("errors");
    await addActivity(`Result report failed: ${error.message}`, "error");
  }
}

async function updateSettings(settings = {}) {
  state.token = settings.token ?? state.token;
  state.teamId = settings.teamId ?? state.teamId;
  state.extensionKey = settings.extensionKey ?? state.extensionKey;
  state.apiBase = normalizeApiBase(settings.apiBase || state.apiBase);
  state.pollSeconds = Number(settings.pollSeconds || state.pollSeconds || DEFAULT_POLL_SECONDS);

  await chrome.storage.local.set({
    token: state.token,
    teamId: state.teamId,
    extensionKey: state.extensionKey,
    apiBase: state.apiBase,
    pollSeconds: state.pollSeconds
  });
  configurePolling();
  updateBadge();
  return { ok: true };
}

async function setPaused(paused) {
  state.paused = paused;
  await chrome.storage.local.set({ paused });
  updateBadge();
  await addActivity(paused ? "Polling paused" : "Polling resumed", paused ? "info" : "success");
  return { ok: true, paused };
}

function incrementStat(key) {
  state.stats = { ...state.stats, [key]: (state.stats?.[key] || 0) + 1 };
  chrome.storage.local.set({ stats: state.stats });
  updateBadge();
}

async function addActivity(message, level = "info") {
  state.activityLog = [
    { message, level, at: new Date().toISOString() },
    ...(state.activityLog || [])
  ].slice(0, 30);
  await chrome.storage.local.set({ activityLog: state.activityLog });
}

function updateBadge() {
  const text = state.paused ? "II" : String(state.stats?.leadsAdded || "");
  chrome.action.setBadgeText({ text: text === "0" ? "" : text });
  chrome.action.setBadgeBackgroundColor({ color: state.paused ? "#f59e0b" : "#2563eb" });
}

function notify(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon-48.png",
    title,
    message
  });
}

function isLinkedInUrl(url = "") {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("linkedin.com") && parsed.pathname.includes("/in/");
  } catch {
    return false;
  }
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

async function safeResponseText(res) {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}
