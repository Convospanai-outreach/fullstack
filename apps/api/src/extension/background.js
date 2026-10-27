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
    syncTokenExpiresAt: "",
    team: null,
    needsReconnect: false,
    defaultTone: "Friendly",
    defaultOutreachAngle: "Sales introduction"
  },
  savedLead: null,
  captureCount: 0,
  activityLog: []
};

// The CraftMyFunnel site may hand over a sync token from its connect page. Only these pages are
// listed in externally_connectable, and the sender is checked again here.
const CMF_SITE_ORIGINS = ["https://craftmyfunnel.live", "https://www.craftmyfunnel.live"];
const CMF_CONNECT_PATH = "/extension/connect";
// Replies from the workspace that mean the saved sync token no longer works.
const CMF_AUTH_ERROR_CODES = ["INVALID_TOKEN", "TOKEN_TEAM_REVOKED", "MISSING_TOKEN", "LEGACY_IDENTITY_DISABLED", "ACCOUNT_SUSPENDED"];

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

  if (msg?.type === "CMF_CHECK_CONNECTION") {
    checkConnection().then(sendResponse);
    return true;
  }

  if (msg?.type === "CMF_LIST_SEQUENCES") {
    listSequences().then(sendResponse);
    return true;
  }

  if (msg?.type === "CMF_ADD_TO_SEQUENCE") {
    addLeadToSequence(msg.leadId, msg.sequenceId).then(sendResponse);
    return true;
  }

  if (msg?.type === "CMF_LIST_DUE_STEPS") {
    listDueSteps().then(sendResponse);
    return true;
  }

  if (msg?.type === "CMF_MARK_STEP_DONE") {
    markStepDone(msg.runId).then(sendResponse);
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

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  const origin = siteOrigin(sender);
  if (!origin) {
    sendResponse({ ok: false, error: "This page can't connect the extension." });
    return false;
  }

  if (msg?.type === "CMF_PING") {
    getState().then((state) => sendResponse({
      ok: true,
      version: chrome.runtime.getManifest().version,
      connected: Boolean(state.settings.workspaceUrl && state.settings.syncToken)
    }));
    return true;
  }

  if (msg?.type === "CMF_CONNECT") {
    connectFromSite(msg, origin)
      .then((result) => {
        sendResponse(result);
        if (result.ok) return retryPendingLead();
      })
      .catch((error) => sendResponse({ ok: false, error: error?.message || "The extension couldn't save the connection." }));
    return true;
  }

  sendResponse({ ok: false, error: "Unknown request." });
  return false;
});

// The sender's origin when it is the CraftMyFunnel connect page, otherwise "".
function siteOrigin(sender) {
  const origin = String(sender?.origin || "");
  if (!CMF_SITE_ORIGINS.includes(origin)) return "";
  const url = String(sender?.url || "");
  if (!url.startsWith(`${origin}/`)) return "";
  // Only the connect page may talk to the extension.
  try {
    if (new URL(url).pathname !== CMF_CONNECT_PATH) return "";
  } catch {
    return "";
  }
  return origin;
}

// Saves the sync token the connect page handed over. The workspace is always the site the
// page is on, saved as the bare domain.
async function connectFromSite(msg, origin) {
  if (msg.version !== 1) return { ok: false, error: "Update the CraftMyFunnel extension and try again." };
  const workspaceUrl = workspaceBase({ workspaceUrl: origin });
  if (typeof msg.workspaceUrl !== "string" || workspaceBase({ workspaceUrl: msg.workspaceUrl }) !== workspaceUrl) {
    return { ok: false, error: "The workspace address doesn't match this site." };
  }
  const syncToken = typeof msg.syncToken === "string" ? msg.syncToken.trim() : "";
  if (!syncToken || syncToken.length > 512) return { ok: false, error: "No sync token was received." };
  const expiresAt = typeof msg.expiresAt === "string" ? Date.parse(msg.expiresAt) : NaN;
  if (Number.isNaN(expiresAt)) return { ok: false, error: "The sync token has no expiry date." };
  const team = msg.team && typeof msg.team === "object"
    ? { id: String(msg.team.id || "").slice(0, 120), name: String(msg.team.name || "").slice(0, 200) }
    : null;

  const state = await getState();
  const settings = {
    ...state.settings,
    workspaceUrl,
    syncToken,
    syncTokenExpiresAt: new Date(expiresAt).toISOString(),
    team,
    extensionKey: "",
    needsReconnect: false
  };
  const activityLog = addActivity(state.activityLog, team?.name ? `Connected to ${team.name}` : "Connected to CraftMyFunnel");
  await chrome.storage.local.set({ settings, activityLog });
  return { ok: true, version: chrome.runtime.getManifest().version };
}

// Sends the lead that was saved while the extension was not connected.
async function retryPendingLead() {
  const state = await getState();
  const lead = state.savedLead;
  if (lead?.status !== "pending_sync") return;
  const { status: _status, leadId: _leadId, syncError: _syncError, ...payload } = lead;
  const syncResult = await trySyncLead(payload, state.settings);
  const latest = await getState();
  // A profile saved while this was sending replaces the one sent here; keep the newer one.
  if (latest.savedLead?.savedAt !== lead.savedAt || latest.savedLead?.profileUrl !== lead.profileUrl) return;
  if (!syncResult.ok) {
    await chrome.storage.local.set({ savedLead: { ...lead, syncError: syncResult.error || "" } });
    return;
  }
  await chrome.storage.local.set({
    savedLead: { ...lead, status: "synced", leadId: syncResult.leadId || lead.leadId || "", syncError: "" },
    activityLog: addActivity(latest.activityLog, "Lead synced to workspace")
  });
}

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
    settings: withConnectionDetails(state.settings, patch.settings),
    activityLog: patch.activityLog ? patch.activityLog.slice(0, 5) : state.activityLog
  };
  await chrome.storage.local.set(next);
  return { ok: true, ...next };
}

// A sync token typed in by hand replaces the one the site handed over, along with its details.
function withConnectionDetails(current, patch = {}) {
  const next = { ...current, ...patch };
  if (patch.syncToken !== undefined && patch.syncToken !== current.syncToken) {
    return { ...next, syncTokenExpiresAt: "", team: null, needsReconnect: false };
  }
  return next;
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
      : syncResult.notConnected
        ? "Saved here. It will send to CraftMyFunnel when you connect the extension."
        : syncResult.authFailed
          ? "Saved here. Your connection to CraftMyFunnel has ended; click Reconnect in Settings to send it."
          : "Pending Sync. Saved locally until CraftMyFunnel is reachable.",
    error: syncResult.error || "",
    activityLog
  };
}

// Where requests go. www.craftmyfunnel.live redirects to the bare domain, and the browser does
// not follow a redirect for a request that carries the sync token, so the saved address is
// corrected here instead of asking everyone to retype it.
function workspaceBase(settings) {
  return String(settings?.workspaceUrl || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/^https:\/\/www\.craftmyfunnel\.live$/i, "https://craftmyfunnel.live");
}

async function trySyncLead(lead, settings) {
  const request = workspaceRequest(settings);
  if (!request) return { ok: false, notConnected: true, error: "Not connected to CraftMyFunnel yet." };

  try {
    const response = await fetch(`${request.workspaceUrl}/api/extension/leads/capture`, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({
        ...lead,
        source: "chrome_extension",
        channel: "LINKEDIN",
        linkedinUrl: lead.profileUrl || lead.linkedinUrl
      })
    });
    const data = await readWorkspaceReply(response);
    if (!response.ok || data.success === false) {
      return { ok: false, authFailed: isAuthFailure(response, data), error: data.error || `Workspace returned ${response.status}.` };
    }
    return { ok: true, leadId: data.leadId || "", matchedExisting: Boolean(data.matchedExisting) };
  } catch (error) {
    return { ok: false, error: error?.message || "Workspace unavailable." };
  }
}

async function markLinkedInOutreachDone(leadId, notes) {
  const state = await getState();
  const request = workspaceRequest(state.settings);
  const resolvedLeadId = leadId || state.savedLead?.leadId;
  if (!request || !resolvedLeadId) {
    return { ok: false, error: "Sync the lead before marking LinkedIn outreach done." };
  }

  try {
    const response = await fetch(`${request.workspaceUrl}/api/extension/leads/${resolvedLeadId}/linkedin-contacted`, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ notes })
    });
    const data = await readWorkspaceReply(response);
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

function workspaceRequest(settings) {
  const workspaceUrl = workspaceBase(settings);
  if (!workspaceUrl || !settings?.syncToken) return null;
  return {
    workspaceUrl,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.syncToken}`
    }
  };
}

// Reads the workspace's reply. When it says the sync token no longer works, the popup offers
// Reconnect.
async function readWorkspaceReply(response) {
  const data = await response.json().catch(() => ({}));
  if (isAuthFailure(response, data)) await setNeedsReconnect(true);
  return data;
}

function isAuthFailure(response, data) {
  return (response.status === 401 || response.status === 403) && CMF_AUTH_ERROR_CODES.includes(data?.code);
}

async function setNeedsReconnect(needsReconnect) {
  const state = await getState();
  if (Boolean(state.settings.needsReconnect) === needsReconnect) return;
  await chrome.storage.local.set({ settings: { ...state.settings, needsReconnect } });
}

async function checkConnection() {
  const state = await getState();
  const request = workspaceRequest(state.settings);
  if (!request) return { ok: false, error: "Not connected. Click Connect to CraftMyFunnel in Settings." };
  try {
    const response = await fetch(`${request.workspaceUrl}/api/extension/auth/validate`, { headers: request.headers });
    const data = await readWorkspaceReply(response);
    if (!response.ok || data.valid === false) return { ok: false, error: data.error || `Workspace returned ${response.status}.` };
    await setNeedsReconnect(false);
    return { ok: true, user: data.user || null, team: data.team || null };
  } catch (error) {
    return { ok: false, error: error?.message || "Workspace unavailable." };
  }
}

async function listSequences() {
  const state = await getState();
  const request = workspaceRequest(state.settings);
  if (!request) return { ok: false, error: "Connect CraftMyFunnel in Settings first." };
  try {
    const response = await fetch(`${request.workspaceUrl}/api/extension/sequences`, { headers: request.headers });
    const data = await readWorkspaceReply(response);
    if (!response.ok || data.success === false) return { ok: false, error: data.error || `Workspace returned ${response.status}.` };
    return { ok: true, sequences: Array.isArray(data.sequences) ? data.sequences : [] };
  } catch (error) {
    return { ok: false, error: error?.message || "Workspace unavailable." };
  }
}

async function addLeadToSequence(leadId, sequenceId) {
  const state = await getState();
  const request = workspaceRequest(state.settings);
  const resolvedLeadId = leadId || state.savedLead?.leadId;
  if (!request || !resolvedLeadId) return { ok: false, error: "Sync the lead before adding it to a sequence." };
  if (!sequenceId) return { ok: false, error: "Choose a sequence first." };
  try {
    const response = await fetch(`${request.workspaceUrl}/api/extension/leads/${encodeURIComponent(resolvedLeadId)}/sequence`, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({ sequenceId })
    });
    const data = await readWorkspaceReply(response);
    if (!response.ok || data.success === false) return { ok: false, error: data.error || `Workspace returned ${response.status}.` };
    const activityLog = addActivity(
      state.activityLog,
      data.status === "ENROLLED" ? `Added to sequence: ${data.sequence?.name || ""}` : `Sequence chosen: ${data.sequence?.name || ""} (waiting for an email)`
    );
    await chrome.storage.local.set({ activityLog });
    return { ok: true, ...data, activityLog };
  } catch (error) {
    return { ok: false, error: error?.message || "Workspace unavailable." };
  }
}

// LinkedIn sequence steps that are waiting on this person in CraftMyFunnel.
async function listDueSteps() {
  const state = await getState();
  const request = workspaceRequest(state.settings);
  if (!request) return { ok: false, error: "Connect CraftMyFunnel in Settings to see your due steps." };
  try {
    const response = await fetch(`${request.workspaceUrl}/api/extension/steps`, { headers: request.headers });
    const data = await readWorkspaceReply(response);
    if (!response.ok || data.success === false) return { ok: false, error: data.error || `Workspace returned ${response.status}.` };
    return { ok: true, steps: Array.isArray(data.steps) ? data.steps : [] };
  } catch (error) {
    return { ok: false, error: error?.message || "Workspace unavailable." };
  }
}

// The person did the step on LinkedIn themselves; CraftMyFunnel moves the sequence on.
async function markStepDone(runId) {
  const state = await getState();
  const request = workspaceRequest(state.settings);
  if (!request || !runId) return { ok: false, error: "Connect CraftMyFunnel in Settings first." };
  try {
    const response = await fetch(`${request.workspaceUrl}/api/extension/steps/${encodeURIComponent(runId)}/done`, {
      method: "POST",
      headers: request.headers
    });
    const data = await readWorkspaceReply(response);
    if (!response.ok || data.success === false) return { ok: false, error: data.error || `Workspace returned ${response.status}.` };
    const activityLog = addActivity(state.activityLog, `LinkedIn step done: ${data.action || ""}`);
    await chrome.storage.local.set({ activityLog });
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
    const onLinkedIn = url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com");
    return onLinkedIn && url.pathname.includes("/in/");
  } catch {
    return false;
  }
}
