const apiBaseInput = document.getElementById("apiBaseInput");
const tokenInput = document.getElementById("tokenInput");
const extensionKeyInput = document.getElementById("extensionKeyInput");
const teamIdInput = document.getElementById("teamIdInput");
const saveSettings = document.getElementById("saveSettings");
const pauseToggle = document.getElementById("pauseToggle");
const addLead = document.getElementById("addLead");
const insertDraft = document.getElementById("insertDraft");
const logTask = document.getElementById("logTask");
const manualTaskType = document.getElementById("manualTaskType");
const draftText = document.getElementById("draftText");
const statusMsg = document.getElementById("statusMsg");
const activityLog = document.getElementById("activityLog");

init();

async function init() {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  apiBaseInput.value = state.apiBase || "http://localhost:3000/api";
  tokenInput.value = state.token || "";
  extensionKeyInput.value = state.extensionKey || "";
  teamIdInput.value = state.teamId || "";
  renderState(state);
}

saveSettings.addEventListener("click", async () => {
  const settings = {
    apiBase: cmfNormalizeApiBase(apiBaseInput.value.trim()),
    token: tokenInput.value.trim(),
    extensionKey: extensionKeyInput.value.trim(),
    teamId: teamIdInput.value.trim()
  };

  await chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", settings });
  setStatus("Settings saved.", "success");
  init();
});

pauseToggle.addEventListener("click", async () => {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  const response = await chrome.runtime.sendMessage({
    type: "TOGGLE_PAUSE",
    paused: !state.paused
  });
  setStatus(response.paused ? "Polling paused." : "Polling resumed.", "success");
  init();
});

addLead.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!cmfIsLinkedInProfileUrl(tab?.url)) {
    setStatus("Open a LinkedIn profile first.", "error");
    return;
  }

  chrome.tabs.sendMessage(tab.id, {
    type: "EXECUTE_TASK",
    task: { id: `manual-${Date.now()}`, type: "ADD_LEAD", payload: {} }
  }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Refresh the LinkedIn page and try again.", "error");
      return;
    }
    setStatus(response?.ok ? "Lead added." : response?.error || "Could not add lead.", response?.ok ? "success" : "error");
    init();
  });
});

insertDraft.addEventListener("click", async () => {
  const text = draftText.value.trim();
  if (!text) {
    setStatus("Enter draft text first.", "error");
    return;
  }

  const tab = await getActiveTab();
  if (!tab?.url?.includes("linkedin.com")) {
    setStatus("Open LinkedIn and click into a text box first.", "error");
    return;
  }

  chrome.tabs.sendMessage(tab.id, {
    type: "EXECUTE_TASK",
    task: {
      id: `manual-${Date.now()}`,
      type: "INSERT_DRAFT",
      payload: { draft: text }
    }
  }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Refresh the LinkedIn page and try again.", "error");
      return;
    }
    setStatus(response?.ok ? "Draft inserted for review." : response?.error || "No active text box found.", response?.ok ? "success" : "error");
    init();
  });
});

logTask.addEventListener("click", async () => {
  const tab = await getActiveTab();
  await chrome.runtime.sendMessage({
    type: "LOG_MANUAL_LINKEDIN_ACTION",
    payload: {
      profileUrl: tab?.url || "",
      action: manualTaskType.value,
      note: "Manual LinkedIn task completed by user."
    }
  });
  setStatus("Manual task logged.", "success");
  init();
});

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function renderState(state) {
  const stats = state.stats || {};
  document.getElementById("leadsAdded").textContent = stats.leadsAdded || 0;
  document.getElementById("draftsInserted").textContent = stats.draftsInserted || 0;
  document.getElementById("tasksCompleted").textContent = stats.tasksCompleted || 0;
  document.getElementById("errors").textContent = stats.errors || 0;
  pauseToggle.textContent = state.paused ? "Resume" : "Pause";

  activityLog.innerHTML = "";
  for (const item of state.activityLog || []) {
    const li = document.createElement("li");
    li.textContent = `${formatTime(item.at)} ${item.message}`;
    activityLog.appendChild(li);
  }
}

function setStatus(message, type = "") {
  statusMsg.textContent = message;
  statusMsg.className = type;
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
