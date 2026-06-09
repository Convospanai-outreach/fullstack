const CMF_SIDEBAR_ID = "cmf-linkedin-assistant";

// Version 1 is limited to visible LinkedIn profile capture for manual review.
// Version 2 task execution and draft insertion remain planned, but disabled.
const CMF_CONTENT_FEATURES = {
  visibleProfileCapture: true,
  backendLeadSync: false,
  draftInsertion: false,
  taskExecution: false,
  manualTaskLogging: false
};

initAssistant();

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "CMF_CAPTURE_VISIBLE_PROFILE") {
    try {
      const profile = captureVisibleProfile();
      chrome.runtime
        .sendMessage({ type: "CMF_STORE_VISIBLE_PROFILE", profile })
        .then(sendResponse);
      return true;
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
      return false;
    }
  }

  return false;
});

function initAssistant() {
  if (!CMF_CONTENT_FEATURES.visibleProfileCapture || !isLinkedInProfilePage()) return;
  injectSidebar();
}

function injectSidebar() {
  if (document.getElementById(CMF_SIDEBAR_ID)) return;

  const root = document.createElement("div");
  root.id = CMF_SIDEBAR_ID;
  root.innerHTML = `
    <button class="cmf-toggle" type="button" aria-label="Open CraftMyFunnel capture">CMF</button>
    <section class="cmf-panel" aria-label="CraftMyFunnel visible profile capture">
      <div class="cmf-title">CraftMyFunnel</div>
      <button id="cmf-capture-profile" type="button">Capture Visible Profile</button>
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
    #${CMF_SIDEBAR_ID} button:not(.cmf-toggle) {
      width: 100%;
      min-height: 34px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #f8fafc;
      color: #0f172a;
      cursor: pointer;
      margin-bottom: 8px;
      font-size: 13px;
      font-weight: 600;
    }
    #${CMF_SIDEBAR_ID} button:not(.cmf-toggle):hover {
      background: #eef4ff;
      border-color: #93b4f6;
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

  root.querySelector("#cmf-capture-profile").addEventListener("click", captureFromSidebar);
}

async function captureFromSidebar() {
  try {
    const profile = captureVisibleProfile();
    const response = await chrome.runtime.sendMessage({
      type: "CMF_STORE_VISIBLE_PROFILE",
      profile
    });
    setSidebarStatus(response?.ok ? "Visible profile captured." : response?.error || "Could not capture profile.");
  } catch (error) {
    setSidebarStatus(error.message || "Could not capture profile.");
  }
}

function captureVisibleProfile() {
  if (!isLinkedInProfilePage()) {
    throw new Error("Open a LinkedIn profile page before capturing.");
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

  return {
    profileUrl: cleanProfileUrl(),
    name,
    headline,
    company: findCompany()
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
