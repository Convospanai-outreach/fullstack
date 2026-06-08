const CMF_SIDEBAR_ID = "cmf-linkedin-assistant";

let lastFocusedEditor = null;

document.addEventListener("focusin", (event) => {
  if (isEditable(event.target)) {
    lastFocusedEditor = event.target;
  }
});

initAssistant();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "EXECUTE_TASK") return false;

  executeTask(msg.task)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});

function initAssistant() {
  if (!isLinkedInProfilePage()) return;
  injectSidebar();
}

async function executeTask(task) {
  const startTime = Date.now();
  const type = task.type;

  try {
    if (type === "ADD_LEAD") {
      const profile = captureVisibleProfile();
      const response = await chrome.runtime.sendMessage({
        type: "ADD_LEAD",
        taskId: task.id,
        data: profile
      });
      return response || { ok: true };
    }

    if (type === "INSERT_DRAFT") {
      const text = task.payload?.draft || task.payload?.text || task.payload?.note || "";
      const inserted = insertDraft(text);
      const status = inserted ? "SUCCESS" : "ERROR";
      reportTask(task, status, {
        profileUrl: cleanProfileUrl(),
        error: inserted ? undefined : "No active LinkedIn text box found. Click into the editor first.",
        durationMs: Date.now() - startTime
      });
      return { ok: inserted };
    }

    if (type === "LOG_MANUAL_LINKEDIN_ACTION") {
      await chrome.runtime.sendMessage({
        type: "LOG_MANUAL_LINKEDIN_ACTION",
        payload: {
          profileUrl: cleanProfileUrl(),
          action: task.payload?.action || "LINKEDIN_TASK",
          note: task.payload?.note || ""
        }
      });
      reportTask(task, "SUCCESS", { profileUrl: cleanProfileUrl() });
      return { ok: true };
    }

    reportTask(task, "ERROR", { error: `Unsupported content task: ${type}` });
    return { ok: false, error: `Unsupported content task: ${type}` };
  } catch (error) {
    reportTask(task, "ERROR", {
      error: error.message,
      durationMs: Date.now() - startTime
    });
    return { ok: false, error: error.message };
  }
}

function injectSidebar() {
  if (document.getElementById(CMF_SIDEBAR_ID)) return;

  const root = document.createElement("div");
  root.id = CMF_SIDEBAR_ID;
  root.innerHTML = `
    <button class="cmf-toggle" type="button" aria-label="Open CraftMyFunnel Assistant">CMF</button>
    <section class="cmf-panel" aria-label="CraftMyFunnel Assistant">
      <div class="cmf-title">CraftMyFunnel</div>
      <button id="cmf-add-lead" type="button">Add to CMF</button>
      <textarea id="cmf-draft" rows="4" placeholder="Draft note to insert"></textarea>
      <button id="cmf-insert-draft" type="button">Insert Draft</button>
      <select id="cmf-task-label" aria-label="Manual task label">
        <option value="LINKEDIN_TASK">LINKEDIN_TASK</option>
        <option value="WHATSAPP_TASK">WHATSAPP_TASK</option>
        <option value="CALL_TASK">CALL_TASK</option>
      </select>
      <button id="cmf-log-action" type="button">Log Manual LinkedIn Task</button>
      <div id="cmf-status" role="status"></div>
    </section>
  `;

  const style = document.createElement("style");
  style.textContent = `
    #${CMF_SIDEBAR_ID} {
      position: fixed;
      right: 16px;
      top: 148px;
      z-index: 2147483647;
      font-family: Arial, sans-serif;
      color: #0f172a;
    }
    #${CMF_SIDEBAR_ID} .cmf-toggle {
      width: 48px;
      height: 48px;
      border: 0;
      border-radius: 8px;
      background: #2563eb;
      color: #fff;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2);
    }
    #${CMF_SIDEBAR_ID} .cmf-panel {
      display: none;
      width: 236px;
      margin-top: 8px;
      padding: 12px;
      background: #fff;
      border: 1px solid #dbe3ef;
      border-radius: 8px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.22);
    }
    #${CMF_SIDEBAR_ID}.open .cmf-panel {
      display: block;
    }
    #${CMF_SIDEBAR_ID} .cmf-title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    #${CMF_SIDEBAR_ID} button:not(.cmf-toggle),
    #${CMF_SIDEBAR_ID} select,
    #${CMF_SIDEBAR_ID} textarea {
      width: 100%;
      box-sizing: border-box;
      border-radius: 6px;
      font-size: 13px;
    }
    #${CMF_SIDEBAR_ID} button:not(.cmf-toggle) {
      min-height: 34px;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #0f172a;
      cursor: pointer;
      margin-bottom: 8px;
      font-weight: 600;
    }
    #${CMF_SIDEBAR_ID} button:not(.cmf-toggle):hover {
      background: #eef4ff;
      border-color: #93b4f6;
    }
    #${CMF_SIDEBAR_ID} textarea {
      resize: vertical;
      border: 1px solid #cbd5e1;
      padding: 8px;
      margin-bottom: 8px;
      color: #0f172a;
    }
    #${CMF_SIDEBAR_ID} select {
      min-height: 32px;
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #0f172a;
      margin-bottom: 8px;
    }
    #${CMF_SIDEBAR_ID} #cmf-status {
      min-height: 16px;
      color: #475569;
      font-size: 12px;
      line-height: 1.35;
    }
  `;

  document.documentElement.appendChild(style);
  document.body.appendChild(root);

  root.querySelector(".cmf-toggle").addEventListener("click", () => {
    root.classList.toggle("open");
  });

  root.querySelector("#cmf-add-lead").addEventListener("click", addLeadFromSidebar);
  root.querySelector("#cmf-insert-draft").addEventListener("click", () => {
    const draft = root.querySelector("#cmf-draft").value;
    setSidebarStatus(insertDraft(draft) ? "Draft inserted. Review it before posting manually." : "Click into a LinkedIn text box first.");
  });
  root.querySelector("#cmf-log-action").addEventListener("click", async () => {
    const action = root.querySelector("#cmf-task-label").value;
    await chrome.runtime.sendMessage({
      type: "LOG_MANUAL_LINKEDIN_ACTION",
      payload: {
        profileUrl: cleanProfileUrl(),
        action,
        note: "Manual LinkedIn task completed by user."
      }
    });
    setSidebarStatus("Manual LinkedIn task logged.");
  });
}

async function addLeadFromSidebar() {
  const profile = captureVisibleProfile();
  setSidebarStatus("Adding lead...");
  const response = await chrome.runtime.sendMessage({ type: "ADD_LEAD", data: profile });
  setSidebarStatus(response?.ok ? "Lead added to CraftMyFunnel." : response?.error || "Could not add lead.");
}

function captureVisibleProfile() {
  if (!isLinkedInProfilePage()) {
    throw new Error("Open a LinkedIn profile page before adding a lead.");
  }

  const name = textFromSelectors([
    "main h1",
    "h1.text-heading-xlarge",
    ".pv-text-details__left-panel h1"
  ]);

  const headline = textFromSelectors([
    ".text-body-medium.break-words",
    ".pv-text-details__left-panel .text-body-medium",
    "main section .text-body-medium"
  ]);

  const company = findCompany();

  return {
    profileUrl: cleanProfileUrl(),
    name,
    headline,
    company
  };
}

function findCompany() {
  const companyLink = Array.from(document.querySelectorAll('a[href*="/company/"]'))
    .map((el) => normalizeText(el.textContent))
    .find(Boolean);

  if (companyLink) return companyLink;

  const experienceSection = Array.from(document.querySelectorAll("section"))
    .find((section) => normalizeText(section.textContent).startsWith("Experience"));

  if (!experienceSection) return "";

  const candidate = experienceSection.querySelector('span[aria-hidden="true"], .t-14.t-normal');
  return normalizeText(candidate?.textContent || "");
}

function insertDraft(text) {
  if (!text.trim()) return false;

  const editor = getActiveEditor();
  if (!editor) return false;

  editor.focus();
  if (editor.isContentEditable) {
    editor.textContent = text;
  } else {
    editor.value = text;
  }

  editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
  editor.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function getActiveEditor() {
  const active = document.activeElement;
  if (isEditable(active)) return active;
  if (isEditable(lastFocusedEditor)) return lastFocusedEditor;

  return document.querySelector([
    '[contenteditable="true"][role="textbox"]',
    '[contenteditable="true"]',
    "textarea",
    'input[type="text"]'
  ].join(","));
}

function isEditable(element) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName?.toLowerCase();
  return tag === "textarea" || (tag === "input" && ["text", "search"].includes(element.type));
}

function reportTask(task, status, details = {}) {
  chrome.runtime.sendMessage({
    type: "TASK_RESULT",
    result: {
      taskId: task.id,
      type: task.type,
      status,
      ...details
    }
  });
}

function textFromSelectors(selectors) {
  for (const selector of selectors) {
    const value = normalizeText(document.querySelector(selector)?.textContent || "");
    if (value) return value;
  }
  return "";
}

function cleanProfileUrl() {
  const url = new URL(window.location.href);
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "/");
}

function isLinkedInProfilePage() {
  return location.hostname.endsWith("linkedin.com") && location.pathname.includes("/in/");
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function setSidebarStatus(message) {
  const status = document.querySelector(`#${CMF_SIDEBAR_ID} #cmf-status`);
  if (status) status.textContent = message;
}

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href === lastUrl) return;
  lastUrl = location.href;
  if (isLinkedInProfilePage()) {
    window.setTimeout(initAssistant, 250);
  }
}).observe(document.documentElement, { subtree: true, childList: true });
