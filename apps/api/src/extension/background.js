// CraftMyFunnel Chrome Extension V1 approval scope.
//
// Active V1 behavior is intentionally narrow:
// - no background crawling
// - no backend sync
// - no tab creation/query orchestration
// - no notifications, cookies, or broad host access
//
// Planned V2 background task polling is preserved in
// background.v2-planned.js but is not referenced by manifest.json.
const CMF_FEATURES = {
  backendSync: false,
  taskPolling: false,
  draftInsertion: false,
  manualTaskLogging: false
};

const DEFAULT_STATE = {
  latestCapture: null,
  captureCount: 0,
  activityLog: []
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
  await chrome.storage.local.set({ ...DEFAULT_STATE, ...stored });
  updateBadge(stored.captureCount || 0);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "CMF_GET_V1_STATE") {
    getState().then(sendResponse);
    return true;
  }

  if (msg?.type === "CMF_STORE_VISIBLE_PROFILE") {
    storeVisibleProfile(msg.profile).then(sendResponse);
    return true;
  }

  if (msg?.type === "CMF_GET_FEATURES") {
    sendResponse(CMF_FEATURES);
    return false;
  }

  return false;
});

async function getState() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_STATE));
  return { ...DEFAULT_STATE, ...stored, features: CMF_FEATURES };
}

async function storeVisibleProfile(profile = {}) {
  const cleaned = {
    profileUrl: String(profile.profileUrl || ""),
    name: String(profile.name || ""),
    headline: String(profile.headline || ""),
    company: String(profile.company || ""),
    capturedAt: new Date().toISOString()
  };

  if (!isLinkedInProfileUrl(cleaned.profileUrl)) {
    return { ok: false, error: "Open a LinkedIn profile page before capturing." };
  }

  const state = await getState();
  const activityLog = [
    {
      at: cleaned.capturedAt,
      message: `Captured visible LinkedIn profile: ${cleaned.name || cleaned.profileUrl}`
    },
    ...(state.activityLog || [])
  ].slice(0, 10);
  const captureCount = Number(state.captureCount || 0) + 1;

  await chrome.storage.local.set({
    latestCapture: cleaned,
    captureCount,
    activityLog
  });
  updateBadge(captureCount);
  return { ok: true, profile: cleaned };
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
