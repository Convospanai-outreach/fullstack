const API_BASE = "http://localhost:3000/api/proxy";
const EXTENSION_KEY = "convo-ext-key-dev"; // This would normally be injected or configured

let state = {
  token: null,
  teamId: null,
  offlineQueue: []
};

// In-memory tab tracking
const pendingTasksByTabId = {};

// Initialize state
chrome.storage.local.get(["token", "teamId", "offlineQueue", "apiBase"], (res) => {
  if (res.token) state.token = res.token;
  if (res.teamId) state.teamId = res.teamId;
  if (res.offlineQueue) state.offlineQueue = res.offlineQueue;
  
  if (!res.apiBase) {
    chrome.storage.local.set({ apiBase: API_BASE });
  }
});

// Setup alarm for polling
chrome.alarms.get("pollTasks", (alarm) => {
  if (!alarm) {
    chrome.alarms.create("pollTasks", { periodInMinutes: 0.5 }); // 30 seconds
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pollTasks") {
    pollTasks();
  }
});

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "x-extension-key": EXTENSION_KEY, // Needs a real value in prod
    "Authorization": state.token ? `Bearer ${state.token}` : "",
    "x-team-id": state.teamId || ""
  };
}

async function getApiBase() {
  const res = await chrome.storage.local.get("apiBase");
  return res.apiBase || API_BASE;
}

async function pollTasks() {
  if (!state.token || !state.teamId) return;

  const apiBase = await getApiBase();
  try {
    const res = await fetch(`${apiBase}/extension/tasks`, {
      method: "GET",
      headers: getHeaders()
    });

    if (!res.ok) return;

    const data = await res.json();
    if (data.tasks && data.tasks.length > 0) {
      for (const task of data.tasks) {
        processTask(task);
      }
    }
  } catch (err) {
    console.error("Poll error:", err);
  }
}

async function processTask(task) {
  const { id, type, payload } = task;
  
  // Need a linkedin URL
  let url = payload?.profileUrl;
  if (!url && payload?.leadId) {
    // In a real scenario we might need to fetch the URL, but payload should have it
  }
  if (!url) {
    if (id) {
       sendAction({ taskId: id, status: "ERROR", error: "No profileUrl in payload", teamId: state.teamId });
    }
    return;
  }

  // Find or create a tab for linkedin
  chrome.tabs.query({ url: "*://*.linkedin.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      const tab = tabs[0];
      executeTaskInTab(tab.id, task, url);
    } else {
      chrome.tabs.create({ url, active: false }, (tab) => {
        // Wait for load
        pendingTasksByTabId[tab.id] = task;
      });
    }
  });
}

function executeTaskInTab(tabId, task, url) {
  pendingTasksByTabId[tabId] = task;
  chrome.tabs.update(tabId, { url });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && pendingTasksByTabId[tabId]) {
    const task = pendingTasksByTabId[tabId];
    // Inject or just send message if content script is ready
    chrome.tabs.sendMessage(tabId, { type: "EXECUTE_TASK", task }, (response) => {
        if (chrome.runtime.lastError) {
           console.error("Content script not ready", chrome.runtime.lastError);
           // Might need injection here if manifest didn't match or page navigated too hard
        }
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "PROFILE_DATA") {
    handleProfileData(msg.data).then(() => sendResponse({ ok: true }));
    return true;
  }
  
  if (msg.type === "ACTION_RESULT") {
    handleActionResult(msg.result).then(() => sendResponse({ ok: true }));
    
    // Clear pending task
    if (sender?.tab?.id && pendingTasksByTabId[sender.tab.id]) {
      delete pendingTasksByTabId[sender.tab.id];
    }
    return true;
  }
  
  if (msg.type === "NAVIGATE_PENDING") {
    // Handle deferred re-execution
    if (sender?.tab?.id && pendingTasksByTabId[sender.tab.id]) {
        // We just keep the task in pending, onUpdated will re-trigger
    }
    sendResponse({ ok: true });
    return true;
  }
  
  if (msg.type === "UPDATE_STATE") {
    state.token = msg.token;
    state.teamId = msg.teamId;
    if (msg.apiBase) {
      chrome.storage.local.set({ apiBase: msg.apiBase });
    }
    chrome.storage.local.set({ token: state.token, teamId: state.teamId });
    sendResponse({ ok: true });
    return true;
  }
});

async function handleProfileData(data) {
  const payload = { ...data, teamId: state.teamId };
  await sendPush(payload);
}

async function handleActionResult(result) {
  const payload = { ...result, teamId: state.teamId };
  await sendAction(payload);
}

async function sendPush(payload) {
  const apiBase = await getApiBase();
  try {
    await fetch(`${apiBase}/extension/push`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.error("Failed to push profile", e);
    state.offlineQueue.push({ type: "push", payload });
    chrome.storage.local.set({ offlineQueue: state.offlineQueue });
  }
}

async function sendAction(payload) {
  const apiBase = await getApiBase();
  // Call /action
  try {
    const res = await fetch(`${apiBase}/extension/action`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    
    // Also mark task complete if it has a taskId
    if (payload.taskId) {
       await fetch(`${apiBase}/extension/tasks/complete`, {
         method: "POST",
         headers: getHeaders(),
         body: JSON.stringify({
            taskId: payload.taskId,
            success: payload.status === "SUCCESS",
            result: payload,
            error: payload.status === "ERROR" ? payload.error : undefined,
            teamId: payload.teamId
         })
       });
    }
  } catch (e) {
    console.error("Failed to send action result", e);
    state.offlineQueue.push({ type: "action", payload });
    chrome.storage.local.set({ offlineQueue: state.offlineQueue });
  }
}

async function flushOfflineQueue() {
  const queue = [...state.offlineQueue];
  state.offlineQueue = [];
  chrome.storage.local.set({ offlineQueue: [] });
  
  for (const item of queue) {
    if (item.type === "push") {
      await sendPush(item.payload);
    } else if (item.type === "action") {
      await sendAction(item.payload);
    }
  }
}
