// CraftMyFunnel V1 content script.
// It stays passive on LinkedIn pages and only reads visible profile details
// after the popup sends an explicit user-triggered capture message.

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "CMF_CAPTURE_VISIBLE_PROFILE") {
    captureVisibleProfileWithRetries()
      .then((profile) => chrome.runtime.sendMessage({ type: "CMF_STORE_VISIBLE_PROFILE", profile }))
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (msg?.type === "CMF_DEBUG_PROFILE_CAPTURE") {
    try {
      sendResponse({ ok: true, debug: captureVisibleProfile().debug });
    } catch (error) {
      sendResponse({ ok: false, error: error.message });
    }
    return false;
  }

  return false;
});

async function captureVisibleProfileWithRetries() {
  const attempts = [0, 700, 1600];
  let bestProfile = null;

  for (const delayMs of attempts) {
    if (delayMs) await delay(delayMs);
    const profile = captureVisibleProfile();
    if (scoreProfile(profile) > scoreProfile(bestProfile)) bestProfile = profile;
    if (bestProfile?.name && bestProfile?.profileUrl) break;
  }

  return bestProfile;
}

function captureVisibleProfile() {
  if (!isLinkedInProfilePage()) {
    throw new Error("Open a LinkedIn profile page to capture a lead.");
  }

  const profileUrl = cleanProfileUrl(window.location.href);
  const topCard = findTopCard();
  const nameNode = findNameNode(topCard);
  const rawName = cleanText(nameNode?.innerText || nameNode?.textContent || "");
  const name = isValidName(stripLinkedInBadges(rawName)) ? stripLinkedInBadges(rawName) : fallbackName();
  const headline = safeHeadline(topCard, name);
  const location = safeLocation(topCard);
  const currentCompany = safeCurrentCompany(topCard);

  return {
    profileUrl,
    name,
    headline,
    currentCompany,
    companyName: currentCompany,
    company: currentCompany,
    location,
    debug: {
      topCardFound: Boolean(topCard),
      nameFound: Boolean(name),
      headlineFound: Boolean(headline),
      companyFound: Boolean(currentCompany),
      locationFound: Boolean(location),
      rawName
    }
  };
}

function findTopCard() {
  const main = document.querySelector("main");
  if (!isVisible(main)) return null;
  const h1 = getVisibleElements(["h1"], main).find((node) => isValidName(stripLinkedInBadges(textOf(node))));
  if (!h1) return null;
  return h1.closest(".pv-top-card") ||
    h1.closest("section.artdeco-card") ||
    h1.closest("section") ||
    h1.parentElement;
}

function findNameNode(topCard) {
  return getVisibleElements(["h1"], topCard).find((node) => isValidName(stripLinkedInBadges(textOf(node)))) || null;
}

function safeHeadline(topCard, name) {
  if (!topCard || !name) return "";
  const nameNode = findNameNode(topCard);
  const nameRect = nameNode?.getBoundingClientRect();
  if (!nameRect) return "";

  const candidate = getVisibleElements([".text-body-medium", "div", "span", "p"], topCard)
    .map((node) => ({ node, text: stripLinkedInBadges(textOf(node)), rect: node.getBoundingClientRect() }))
    .filter((item) => item.rect.top >= nameRect.bottom - 8 && item.rect.top <= nameRect.bottom + 120)
    .find((item) => isValidHeadline(item.text, name));

  return candidate?.text || "";
}

function safeLocation(topCard) {
  if (!topCard) return "";
  const candidate = getVisibleElements([".text-body-small", "span", "div"], topCard)
    .map((node) => cleanText(textOf(node)))
    .find((text) => isLikelyLocation(text));
  return candidate || "";
}

function safeCurrentCompany(topCard) {
  if (!topCard) return "";
  const selectors = [
    ".pv-text-details__right-panel span[aria-hidden='true']",
    ".pv-text-details__right-panel a span[aria-hidden='true']",
    ".pv-top-card--experience-list-item span[aria-hidden='true']"
  ];
  const candidate = getVisibleElements(selectors, topCard)
    .map((node) => stripLinkedInBadges(textOf(node)))
    .find((text) => isValidCompany(text));
  return candidate || "";
}

function fallbackName() {
  const title = cleanText(document.querySelector("meta[property='og:title']")?.getAttribute("content") || document.title || "");
  const withoutLinkedIn = title.replace(/\s*\|\s*LinkedIn\s*$/i, "");
  const firstPart = stripLinkedInBadges(withoutLinkedIn.split(" - ")[0] || "");
  return isValidName(firstPart) ? firstPart : "";
}

function cleanProfileUrl(value) {
  const url = new URL(value);
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "/");
}

function isLinkedInProfilePage() {
  return location.hostname.endsWith("linkedin.com") && location.pathname.includes("/in/");
}

function getVisibleElements(selectors, root = document) {
  if (!root) return [];
  return selectors.flatMap((selector) => Array.from(root.querySelectorAll(selector))).filter(isVisible);
}

function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function textOf(node) {
  return cleanText(node?.innerText || node?.textContent || "");
}

function cleanText(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function stripLinkedInBadges(value = "") {
  return cleanText(value)
    .replace(/\s*(?:·|Â·|\|)\s*(1st|2nd|3rd).*$/i, "")
    .replace(/\b(1st|2nd|3rd)\b.*$/i, "")
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .trim();
}

function hasBadgeText(value = "") {
  return /\b(1st|2nd|3rd|followers?|connections?)\b/i.test(value);
}

function isValidName(value = "") {
  const text = stripLinkedInBadges(value);
  if (!text || hasBadgeText(text)) return false;
  if (text.split(/\s+/).filter(Boolean).length < 2) return false;
  return text.length >= 3 && text.length <= 100;
}

function isValidHeadline(value = "", name = "") {
  const text = stripLinkedInBadges(value);
  if (!text || sameText(text, name) || hasBadgeText(text)) return false;
  if (isLikelyLocation(text) || looksLikeEducation(text) || isSectionLabel(text)) return false;
  if (/^(contact info|connect|message|follow|open to|available for)$/i.test(text)) return false;
  return text.length > 3 && text.length < 180;
}

function isValidCompany(value = "") {
  const text = stripLinkedInBadges(value);
  if (!text || hasBadgeText(text) || looksLikeEducation(text) || isLikelyLocation(text) || isSectionLabel(text)) return false;
  return text.length > 1 && text.length < 120;
}

function looksLikeEducation(value = "") {
  return /\b(university|college|school|b\.?a\.?|bcom|b\.?tech|mba|philosophy|education|degree)\b/i.test(value);
}

function isLikelyLocation(value = "") {
  return /,\s*[A-Za-z]/.test(value) || /\b(area|region|india|united states|remote)\b/i.test(value);
}

function isSectionLabel(value = "") {
  return /^(experience|education|activity|about|skills|licenses|certifications|recommendations|interests|current company|company)$/i.test(value);
}

function sameText(a = "", b = "") {
  return cleanText(a).toLowerCase() === cleanText(b).toLowerCase();
}

function scoreProfile(profile) {
  if (!profile) return 0;
  return [profile.name, profile.profileUrl, profile.headline, profile.currentCompany, profile.location].filter(Boolean).length;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
