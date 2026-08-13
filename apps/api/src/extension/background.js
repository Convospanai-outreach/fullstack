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
