const NOT_DETECTED = "Not detected from visible profile.";

const ANGLES = [
  "Partnership",
  "Sales introduction",
  "Demo invitation",
  "Investor / founder connect",
  "Hiring / recruitment",
  "Vendor/service pitch",
  "Event invite",
  "Follow-up",
  "Custom"
];

const NEEDS = ["Unknown", "Low", "Medium", "High"];
const TIMINGS = ["Now", "Later", "Unknown"];
const STATUSES = ["Captured", "To Review", "Ready for Outreach", "Contacted", "Follow-up Needed", "Not Relevant"];

const els = {
  tabs: Array.from(document.querySelectorAll(".tab")),
  panels: Array.from(document.querySelectorAll(".tab-panel")),
  captureProfile: document.getElementById("captureProfile"),
  retryCapture: document.getElementById("retryCapture"),
  copyCapture: document.getElementById("copyCapture"),
  generateDraft: document.getElementById("generateDraft"),
  copyDraft: document.getElementById("copyDraft"),
  saveLead: document.getElementById("saveLead"),
  clearLocalData: document.getElementById("clearLocalData"),
  activityLog: document.getElementById("activityLog"),
  statusMsg: document.getElementById("statusMsg"),
  syncBadge: document.getElementById("syncBadge"),
  saveBadge: document.getElementById("saveBadge"),
  angleOptions: document.getElementById("angleOptions"),
  defaultAngle: document.getElementById("defaultAngle"),
  customAngleWrap: document.getElementById("customAngleWrap"),
  customAngle: document.getElementById("customAngle"),
  customCtaWrap: document.getElementById("customCtaWrap"),
  needOptions: document.getElementById("needOptions"),
  timingOptions: document.getElementById("timingOptions"),
  statusOptions: document.getElementById("statusOptions"),
  fitScoreValue: document.getElementById("fitScoreValue")
};

const fields = {
  captureName: document.getElementById("captureName"),
  captureUrl: document.getElementById("captureUrl"),
  captureHeadline: document.getElementById("captureHeadline"),
  captureCompany: document.getElementById("captureCompany"),
  captureLocation: document.getElementById("captureLocation"),
  noteCompany: document.getElementById("noteCompany"),
  noteRole: document.getElementById("noteRole"),
  noteLocation: document.getElementById("noteLocation"),
  noteIndustry: document.getElementById("noteIndustry"),
  noteNotes: document.getElementById("noteNotes"),
  notePriority: document.getElementById("notePriority"),
  noteLeadType: document.getElementById("noteLeadType"),
  draftTone: document.getElementById("draftTone"),
  draftChannel: document.getElementById("draftChannel"),
  draftCta: document.getElementById("draftCta"),
  customCta: document.getElementById("customCta"),
  messageDraft: document.getElementById("messageDraft"),
  fitScore: document.getElementById("fitScore"),
  workspaceUrl: document.getElementById("workspaceUrl"),
  apiKey: document.getElementById("apiKey"),
  defaultTone: document.getElementById("defaultTone")
};

let state = {};

init();

function init() {
  renderStaticOptions();
  bindEvents();
  loadState();
}

function bindEvents() {
  els.tabs.forEach((tab) => tab.addEventListener("click", () => showTab(tab.dataset.tab)));
  els.captureProfile.addEventListener("click", captureProfile);
  els.retryCapture.addEventListener("click", captureProfile);
  els.copyCapture.addEventListener("click", copyCapture);
  els.generateDraft.addEventListener("click", generateDraft);
  els.copyDraft.addEventListener("click", copyDraft);
  els.saveLead.addEventListener("click", saveLead);
  els.clearLocalData.addEventListener("click", clearLocalData);

  Object.values(fields).forEach((field) => {
    if (!field) return;
    field.addEventListener("input", onFieldChange);
    field.addEventListener("change", onFieldChange);
  });
}

async function loadState() {
  const response = await chrome.runtime.sendMessage({ type: "CMF_GET_V1_STATE" });
  state = normalizeState(response || {});
  renderAll();
}

function normalizeState(raw) {
  return {
    latestCapture: raw.latestCapture || null,
    leadNotes: {
      company: "",
      role: "",
      location: "",
      industry: "",
      notes: "",
      priority: "Medium",
      leadType: "Founder",
      ...(raw.leadNotes || {})
    },
    outreachAngle: raw.outreachAngle || "Sales introduction",
    customAngle: raw.customAngle || "",
    draft: {
      tone: "Friendly",
      channel: "LinkedIn DM",
      cta: "Reply if relevant",
      customCta: "",
      message: "",
      ...(raw.draft || {})
    },
    qualification: {
      fitScore: 3,
      need: "Unknown",
      timing: "Unknown",
      status: "Captured",
      ...(raw.qualification || {})
    },
    settings: {
      workspaceUrl: "",
      apiKey: "",
      defaultTone: "Friendly",
      defaultOutreachAngle: "Sales introduction",
      ...(raw.settings || {})
    },
    savedLead: raw.savedLead || null,
    activityLog: raw.activityLog || []
  };
}

function renderAll() {
  renderCapture();
  renderNotes();
  renderChipGroup(els.angleOptions, ANGLES, state.outreachAngle || "Sales introduction", updateAngle);
  els.customAngleWrap.classList.toggle("hidden", state.outreachAngle !== "Custom");
  els.customAngle.value = state.customAngle || "";
  renderDraft();
  renderQualification();
  renderSettings();
  renderActivity(state.activityLog);
  renderBadges();
}

function renderCapture() {
  const profile = state.latestCapture || {};
  setText(fields.captureName, profile.name || "Not captured yet.", !profile.name);
  setText(fields.captureUrl, profile.profileUrl || "Not captured yet.", !profile.profileUrl);
  setText(fields.captureHeadline, profile.headline || NOT_DETECTED, !profile.headline);
  setText(fields.captureCompany, profile.currentCompany || profile.companyName || profile.company || NOT_DETECTED, !(profile.currentCompany || profile.companyName || profile.company));
  setText(fields.captureLocation, profile.location || NOT_DETECTED, !profile.location);
}

function renderNotes() {
  fields.noteCompany.value = state.leadNotes.company || "";
  fields.noteRole.value = state.leadNotes.role || "";
  fields.noteLocation.value = state.leadNotes.location || "";
  fields.noteIndustry.value = state.leadNotes.industry || "";
  fields.noteNotes.value = state.leadNotes.notes || "";
  fields.notePriority.value = state.leadNotes.priority || "Medium";
  fields.noteLeadType.value = state.leadNotes.leadType || "Founder";
}

function renderDraft() {
  fields.draftTone.value = state.draft.tone || state.settings.defaultTone || "Friendly";
  fields.draftChannel.value = state.draft.channel || "LinkedIn DM";
  fields.draftCta.value = state.draft.cta || "Reply if relevant";
  fields.customCta.value = state.draft.customCta || "";
  fields.messageDraft.value = state.draft.message || "";
  els.customCtaWrap.classList.toggle("hidden", fields.draftCta.value !== "Custom CTA");
}

function renderQualification() {
  fields.fitScore.value = state.qualification.fitScore || 3;
  els.fitScoreValue.textContent = fields.fitScore.value;
  renderChipGroup(els.needOptions, NEEDS, state.qualification.need, (value) => updateQualification({ need: value }));
  renderChipGroup(els.timingOptions, TIMINGS, state.qualification.timing, (value) => updateQualification({ timing: value }));
  renderChipGroup(els.statusOptions, STATUSES, state.qualification.status, (value) => updateQualification({ status: value }));
}

function renderSettings() {
  fields.workspaceUrl.value = state.settings.workspaceUrl || "";
  fields.apiKey.value = state.settings.apiKey || "";
  fields.defaultTone.value = state.settings.defaultTone || "Friendly";
  els.defaultAngle.value = state.settings.defaultOutreachAngle || "Sales introduction";
}

function renderBadges() {
  const savedStatus = state.savedLead?.status;
  const text = savedStatus === "synced" ? "Synced" : "Local only";
  els.syncBadge.textContent = text;
  els.saveBadge.textContent = text;
  els.syncBadge.className = savedStatus === "synced" ? "badge accent" : "badge muted";
  els.saveBadge.className = savedStatus === "synced" ? "badge accent" : "badge muted";
}

function renderStaticOptions() {
  els.defaultAngle.innerHTML = "";
  ANGLES.forEach((angle) => {
    const option = document.createElement("option");
    option.value = angle;
    option.textContent = angle;
    els.defaultAngle.appendChild(option);
  });
  renderChipGroup(els.angleOptions, ANGLES, state.outreachAngle || "Sales introduction", updateAngle);
}

function renderChipGroup(root, values, activeValue, onClick) {
  root.innerHTML = "";
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${value === activeValue ? " active" : ""}`;
    button.textContent = value;
    button.addEventListener("click", () => onClick(value));
    root.appendChild(button);
  });
}

function renderActivity(items = []) {
  els.activityLog.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.textContent = "No recent activity.";
    els.activityLog.appendChild(li);
    return;
  }
  items.slice(0, 5).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = `${formatTime(item.at)} ${item.message}`;
    els.activityLog.appendChild(li);
  });
}

async function captureProfile() {
  setBusy(els.captureProfile, true, "Capturing...");
  setStatus("Looking for visible LinkedIn profile details.", "");
  const tab = await getActiveTab();

  if (!cmfIsLinkedInProfileUrl(tab?.url)) {
    setBusy(els.captureProfile, false);
    setStatus("Open a LinkedIn profile page to capture a lead.", "error");
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "CMF_CAPTURE_VISIBLE_PROFILE" }, async (response) => {
    setBusy(els.captureProfile, false);
    if (chrome.runtime.lastError) {
      setStatus("Refresh the LinkedIn profile page and try again.", "error");
      return;
    }
    if (!response?.ok) {
      setStatus(response?.error || "Could not capture visible profile.", "error");
      return;
    }
    await loadState();
    setStatus("Captured profile. Add notes or generate a draft.", "success");
  });
}

async function copyCapture() {
  if (!state.latestCapture) {
    setStatus("Capture a profile first.", "error");
    return;
  }
  await navigator.clipboard.writeText(JSON.stringify(buildLeadPayload(), null, 2));
  await addLocalActivity("Copied capture");
  setStatus("Capture copied.", "success");
}

async function generateDraft() {
  const draft = createDraftMessage();
  fields.messageDraft.value = draft;
  state.draft.message = draft;
  await persistState({ draft: readDraft() });
  await addLocalActivity("Draft created");
  showTab("draft");
  setStatus("Draft created. Nothing is sent automatically.", "success");
}

async function copyDraft() {
  const draft = fields.messageDraft.value.trim();
  if (!draft) {
    setStatus("Generate or write a draft first.", "error");
    return;
  }
  await navigator.clipboard.writeText(draft);
  await addLocalActivity("Copied message");
  setStatus("Draft copied.", "success");
}

async function saveLead() {
  const payload = buildLeadPayload();
  if (!payload.name || !payload.profileUrl) {
    setStatus("Capture a LinkedIn profile before saving.", "error");
    return;
  }
  setBusy(els.saveLead, true, "Saving...");
  await persistState(readStatePatch());
  const response = await chrome.runtime.sendMessage({ type: "CMF_SAVE_PREPARED_LEAD", payload });
  setBusy(els.saveLead, false);
  await loadState();
  setStatus(response?.message || "Saved locally. Connect CraftMyFunnel workspace to sync.", response?.synced ? "success" : "");
}

async function clearLocalData() {
  const response = await chrome.runtime.sendMessage({ type: "CMF_CLEAR_LOCAL_DATA" });
  state = normalizeState(response || {});
  renderAll();
  setStatus("Local extension data cleared.", "success");
}

function createDraftMessage() {
  const lead = buildLeadPayload();
  const firstName = (lead.name || "there").split(/\s+/)[0];
  const companyPhrase = lead.company ? ` at ${lead.company}` : "";
  const context = lead.headline || lead.userAddedRole || lead.outreachAngle.toLowerCase();
  const cta = lead.qualification?.status === "Follow-up Needed"
    ? "Happy to reconnect if useful."
    : ctaText();

  if (fields.draftChannel.value === "Call note") {
    return `Call note for ${lead.name || "LinkedIn lead"}${companyPhrase}: discuss ${context || "outreach workflow fit"}. ${cta}`;
  }

  if (fields.draftTone.value === "Direct") {
    return `Hi ${firstName}, came across your profile${companyPhrase}. I'm building CraftMyFunnel to help teams manage outreach workflows more intelligently. ${cta}`;
  }

  if (fields.draftTone.value === "Professional") {
    return `Hi ${firstName}, I came across your profile${companyPhrase} and thought CraftMyFunnel may be relevant. It helps teams manage lead and outreach workflow tracking with more structure. ${cta}`;
  }

  if (fields.draftTone.value === "Founder-style") {
    return `Hi ${firstName}, I'm building CraftMyFunnel and your profile stood out${companyPhrase}. We're focused on helping teams prepare and track outreach with clearer human review. ${cta}`;
  }

  return `Hi ${firstName}, came across your profile and thought it may be relevant to connect. I'm building CraftMyFunnel to help teams manage outreach workflows more intelligently. ${cta}`;
}

function ctaText() {
  const selected = fields.draftCta.value;
  if (selected === "Custom CTA") return fields.customCta.value.trim() || "Would be glad to share a quick overview if useful.";
  const map = {
    "Book a call": "Would you be open to a quick call?",
    "Try demo": "Would be happy to share a quick demo if useful.",
    "Reply if relevant": "Would be happy to share a quick overview if useful.",
    "Visit website": "You can also visit the website if this sounds relevant."
  };
  return map[selected] || "Would be happy to share a quick overview if useful.";
}

function buildLeadPayload() {
  const capture = state.latestCapture || {};
  const notes = readLeadNotes();
  const draft = readDraft();
  return {
    source: "linkedin",
    name: capture.name || "",
    profileUrl: capture.profileUrl || "",
    headline: capture.headline || "",
    company: capture.currentCompany || capture.companyName || capture.company || notes.company || "",
    location: capture.location || notes.location || "",
    userAddedCompany: notes.company,
    userAddedRole: notes.role,
    userAddedLocation: notes.location,
    industry: notes.industry,
    notes: notes.notes,
    priority: notes.priority,
    leadType: notes.leadType,
    outreachAngle: state.outreachAngle === "Custom" ? els.customAngle.value.trim() || state.customAngle || "Custom" : state.outreachAngle,
    messageDraft: draft.message,
    qualification: readQualification(),
    capturedAt: capture.capturedAt || new Date().toISOString()
  };
}

function onFieldChange() {
  els.customCtaWrap.classList.toggle("hidden", fields.draftCta.value !== "Custom CTA");
  els.fitScoreValue.textContent = fields.fitScore.value;
  persistState(readStatePatch());
}

function readStatePatch() {
  return {
    leadNotes: readLeadNotes(),
    draft: readDraft(),
    qualification: readQualification(),
    settings: readSettings(),
    customAngle: els.customAngle.value.trim()
  };
}

function readLeadNotes() {
  return {
    company: fields.noteCompany.value.trim(),
    role: fields.noteRole.value.trim(),
    location: fields.noteLocation.value.trim(),
    industry: fields.noteIndustry.value.trim(),
    notes: fields.noteNotes.value.trim(),
    priority: fields.notePriority.value,
    leadType: fields.noteLeadType.value
  };
}

function readDraft() {
  return {
    tone: fields.draftTone.value,
    channel: fields.draftChannel.value,
    cta: fields.draftCta.value,
    customCta: fields.customCta.value.trim(),
    message: fields.messageDraft.value.trim()
  };
}

function readQualification() {
  return {
    fitScore: Number(fields.fitScore.value || 3),
    need: state.qualification.need || "Unknown",
    timing: state.qualification.timing || "Unknown",
    status: state.qualification.status || "Captured"
  };
}

function readSettings() {
  return {
    workspaceUrl: fields.workspaceUrl.value.trim(),
    apiKey: fields.apiKey.value.trim(),
    defaultTone: fields.defaultTone.value,
    defaultOutreachAngle: els.defaultAngle.value
  };
}

async function persistState(patch) {
  state = normalizeState({ ...state, ...patch });
  await chrome.runtime.sendMessage({ type: "CMF_UPDATE_ASSISTANT_STATE", patch });
}

async function addLocalActivity(message) {
  state.activityLog = [{ at: new Date().toISOString(), message }, ...(state.activityLog || [])].slice(0, 5);
  renderActivity(state.activityLog);
  await chrome.runtime.sendMessage({ type: "CMF_UPDATE_ASSISTANT_STATE", patch: { activityLog: state.activityLog } });
}

function updateAngle(value) {
  state.outreachAngle = value;
  els.customAngleWrap.classList.toggle("hidden", value !== "Custom");
  renderChipGroup(els.angleOptions, ANGLES, value, updateAngle);
  persistState({ outreachAngle: value, customAngle: els.customAngle.value.trim() });
}

function updateQualification(patch) {
  state.qualification = { ...state.qualification, ...patch };
  renderQualification();
  persistState({ qualification: state.qualification });
}

function showTab(id) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === id));
  els.panels.forEach((panel) => panel.classList.toggle("active", panel.id === id));
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function setText(element, text, muted) {
  element.textContent = text;
  element.classList.toggle("not-detected", Boolean(muted));
}

function setStatus(message, type = "") {
  els.statusMsg.textContent = message;
  els.statusMsg.className = `status ${type}`.trim();
}

function setBusy(button, busy, text) {
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = text || "Working...";
    button.disabled = true;
    return;
  }
  button.textContent = button.dataset.originalText || button.textContent;
  button.disabled = false;
}

function formatTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
