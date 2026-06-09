const captureProfile = document.getElementById("captureProfile");
const copyCapture = document.getElementById("copyCapture");
const statusMsg = document.getElementById("statusMsg");
const activityLog = document.getElementById("activityLog");

const captureFields = {
  name: document.getElementById("captureName"),
  headline: document.getElementById("captureHeadline"),
  company: document.getElementById("captureCompany"),
  profileUrl: document.getElementById("captureUrl")
};

let latestCapture = null;

init();

captureProfile.addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!cmfIsLinkedInProfileUrl(tab?.url)) {
    setStatus("Open a LinkedIn profile first.", "error");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "CMF_CAPTURE_VISIBLE_PROFILE" }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("Refresh the LinkedIn profile page and try again.", "error");
      return;
    }
    setStatus(response?.ok ? "Visible profile captured." : response?.error || "Could not capture profile.", response?.ok ? "success" : "error");
    init();
  });
});

copyCapture.addEventListener("click", async () => {
  if (!latestCapture) {
    setStatus("Capture a profile first.", "error");
    return;
  }

  await navigator.clipboard.writeText(JSON.stringify(latestCapture, null, 2));
  setStatus("Capture copied.", "success");
});

async function init() {
  const state = await chrome.runtime.sendMessage({ type: "CMF_GET_V1_STATE" });
  latestCapture = state.latestCapture || null;
  renderCapture(latestCapture);
  renderActivity(state.activityLog || []);
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function renderCapture(profile) {
  captureFields.name.textContent = profile?.name || "-";
  captureFields.headline.textContent = profile?.headline || "-";
  captureFields.company.textContent = profile?.company || "-";
  captureFields.profileUrl.textContent = profile?.profileUrl || "-";
}

function renderActivity(items) {
  activityLog.innerHTML = "";
  for (const item of items) {
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
