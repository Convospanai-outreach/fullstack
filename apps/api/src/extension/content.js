// CraftMyFunnel V1 content script.
// Passive on LinkedIn pages: it only reads browser-visible profile details
// after the popup sends an explicit user-triggered capture message.

const CMF_NOT_DETECTED = "Not detected from visible profile.";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "CMF_CAPTURE_VISIBLE_PROFILE") {
    captureVisibleProfileWithRetries()
      .then((profile) => chrome.runtime.sendMessage({ type: "CMF_STORE_VISIBLE_PROFILE", profile }))
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (msg?.type === "CMF_DEBUG_PROFILE_CAPTURE" || msg?.type === "CMF_DEEP_CAPTURE_DEBUG") {
    try {
      const result = runExtraction();
      sendResponse({ ok: true, debug: result.debug });
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
    const profile = runExtraction().profile;
    if (scoreProfile(profile) > scoreProfile(bestProfile)) bestProfile = profile;
    if (bestProfile?.name && bestProfile?.profileUrl && bestProfile?.headline) break;
  }

  return bestProfile;
}

function runExtraction() {
  if (!isLinkedInProfilePage()) {
    throw new Error("Open a LinkedIn profile page to capture a lead.");
  }

  const profileUrl = cleanProfileUrl(window.location.href);
  const meta = collectMeta();
  const jsonLdPeople = collectJsonLdPeople();
  const viewportLines = collectTopViewportLines();
  const domSnapshot = collectDomFallbackSnapshot();
  const candidates = {
    profileUrl: [{ value: profileUrl, source: "url", confidence: "high" }],
    name: [],
    headline: [],
    currentCompany: [],
    location: []
  };

  addJsonLdCandidates(candidates, jsonLdPeople);
  addMetaCandidates(candidates, meta);
  addTitleCandidates(candidates, meta);
  addViewportCandidates(candidates, viewportLines);
  addDomCandidates(candidates, domSnapshot);

  const name = chooseCandidate(candidates.name, isValidName);
  const headline = chooseCandidate(candidates.headline, (value) => isValidHeadline(value, name.value));
  const currentCompany = chooseCandidate(candidates.currentCompany, isValidCompany);
  const location = chooseCandidate(candidates.location, isLikelyLocation);

  const fieldMeta = {
    name: toFieldMeta(name, "Name"),
    profileUrl: { value: profileUrl, source: "url", confidence: "high" },
    headline: toFieldMeta(headline, "Headline"),
    currentCompany: toFieldMeta(currentCompany, "Current Company"),
    location: toFieldMeta(location, "Location")
  };

  const profile = {
    profileUrl,
    name: name.value || "",
    headline: headline.value || "",
    currentCompany: currentCompany.value || "",
    companyName: currentCompany.value || "",
    company: currentCompany.value || "",
    location: location.value || "",
    debug: {
      fieldMeta,
      title: meta.title,
      ogTitle: meta.ogTitle,
      ogDescription: meta.ogDescription,
      metaDescription: meta.description,
      twitterTitle: meta.twitterTitle,
      twitterDescription: meta.twitterDescription,
      jsonLdPerson: jsonLdPeople[0] || null,
      topViewportLines: viewportLines,
      domSnapshot,
      candidates: summarizeCandidates(candidates)
    }
  };

  return { profile, debug: profile.debug };
}

function addJsonLdCandidates(candidates, people) {
  for (const person of people) {
    addCandidate(candidates.name, person.name, "jsonld", "high");
    addCandidate(candidates.headline, person.jobTitle || person.description, "jsonld", "high");
    addCandidate(candidates.currentCompany, readWorksForName(person.worksFor), "jsonld", "high");
    addCandidate(candidates.location, formatAddress(person.address), "jsonld", "high");
  }
}

function addMetaCandidates(candidates, meta) {
  const titleValues = [meta.ogTitle, meta.twitterTitle].filter(Boolean);
  for (const value of titleValues) {
    const parsed = parseLinkedInTitle(value);
    addCandidate(candidates.name, parsed.name, "meta title", "high");
    addCandidate(candidates.headline, parsed.headline, "meta title", "medium");
  }

  const descriptionValues = [meta.ogDescription, meta.description, meta.twitterDescription].filter(Boolean);
  const knownName = firstValid(candidates.name, isValidName)?.value || "";
  for (const value of descriptionValues) {
    const parsed = parseLinkedInDescription(value, knownName);
    addCandidate(candidates.name, parsed.name, "meta description", "medium");
    addCandidate(candidates.headline, parsed.headline, "meta description", "medium");
    addCandidate(candidates.currentCompany, parsed.company, "meta description", "medium");
    addCandidate(candidates.location, parsed.location, "meta description", "medium");
  }
}

function addTitleCandidates(candidates, meta) {
  const parsed = parseLinkedInTitle(meta.title);
  addCandidate(candidates.name, parsed.name, "document.title", "high");
  addCandidate(candidates.headline, parsed.headline, "document.title", "low");
}

function addViewportCandidates(candidates, lines) {
  const nameLine = lines.find((line) => line.isStrongName)?.text || "";
  addCandidate(candidates.name, nameLine, "viewport", "high");

  const nameIndex = lines.findIndex((line) => sameText(line.text, nameLine));
  const afterName = nameIndex >= 0 ? lines.slice(nameIndex + 1) : lines;
  const headline = afterName.find((line) => isMeaningfulViewportLine(line.text) && isValidHeadline(line.text, nameLine))?.text || "";
  const location = afterName.find((line) => isLikelyLocation(line.text))?.text || "";
  const company = afterName.find((line) => isValidCompany(line.text) && line.isRightPanel)?.text || "";

  addCandidate(candidates.headline, headline, "viewport", "medium");
  addCandidate(candidates.location, location, "viewport", "medium");
  addCandidate(candidates.currentCompany, company, "viewport", "medium");
}

function addDomCandidates(candidates, snapshot) {
  addCandidate(candidates.name, snapshot.name, "dom", "medium");
  addCandidate(candidates.headline, snapshot.headline, "dom", "low");
  addCandidate(candidates.currentCompany, snapshot.company, "dom", "medium");
  addCandidate(candidates.location, snapshot.location, "dom", "low");
}

function collectJsonLdPeople() {
  const people = [];
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    const parsed = safeJsonParse(script.text || script.innerText || "");
    walkJson(parsed, (node) => {
      if (isPersonObject(node)) people.push(sanitizeJsonLdPerson(node));
    });
  }
  return people;
}

function collectMeta() {
  return {
    title: cleanText(document.title || ""),
    ogTitle: metaContent('meta[property="og:title"]'),
    ogDescription: metaContent('meta[property="og:description"]'),
    description: metaContent('meta[name="description"]'),
    twitterTitle: metaContent('meta[name="twitter:title"]'),
    twitterDescription: metaContent('meta[name="twitter:description"]')
  };
}

function collectTopViewportLines() {
  const maxTop = window.innerHeight * 0.45;
  const ignoredSelector = [
    "nav",
    "aside",
    "footer",
    "button",
    "[role='button']",
    "input",
    "textarea",
    "select",
    ".global-nav",
    ".msg-overlay-list-bubble",
    ".artdeco-dropdown"
  ].join(",");
  const seen = new Set();

  return Array.from(document.querySelectorAll("main h1, main h2, main h3, main p, main div, main span, main a"))
    .filter((element) => !element.closest(ignoredSelector))
    .filter(isVisible)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const text = stripLinkedInBadges(textOf(element));
      const style = window.getComputedStyle(element);
      return {
        text,
        top: rect.top,
        left: rect.left,
        fontSize: parseFloat(style.fontSize || "0"),
        fontWeight: String(style.fontWeight || ""),
        tagName: element.tagName.toLowerCase(),
        isRightPanel: rect.left > window.innerWidth * 0.48
      };
    })
    .filter((line) => (
      line.text &&
      line.top >= 0 &&
      line.top < maxTop &&
      line.text.length <= 180 &&
      !isIgnoredViewportText(line.text)
    ))
    .sort((a, b) => a.top - b.top || a.left - b.left)
    .filter((line) => {
      const key = line.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((line) => ({
      ...line,
      isStrongName: line.tagName === "h1" || (line.fontSize >= 22 && isValidName(line.text))
    }))
    .slice(0, 30);
}

function collectDomFallbackSnapshot() {
  const firstSection = document.querySelector("main section:first-of-type") || document.querySelector("section:first-of-type");
  const h1 = firstVisibleText(["main h1", "h1", ".text-heading-xlarge"], firstSection || document);
  return {
    name: h1,
    headline: firstVisibleText([".text-body-medium.break-words", ".pv-text-details__left-panel .text-body-medium"], firstSection || document),
    company: firstVisibleText([".pv-text-details__right-panel span[aria-hidden='true']", ".pv-top-card--experience-list-item span[aria-hidden='true']"], firstSection || document),
    location: firstVisibleText([".text-body-small.inline.t-black--light.break-words", ".pv-text-details__left-panel .text-body-small"], firstSection || document)
  };
}

function parseLinkedInTitle(value = "") {
  const text = stripLinkedInBadges(value).replace(/\s*\|\s*LinkedIn\s*$/i, "");
  const parts = text.split(/\s+-\s+/).map(cleanText).filter(Boolean);
  return {
    name: parts[0] || "",
    headline: parts.length > 1 ? parts.slice(1).join(" - ") : ""
  };
}

function parseLinkedInDescription(value = "", knownName = "") {
  const text = stripLinkedInBadges(value).replace(/\s*\|\s*LinkedIn\s*$/i, "");
  const parsedTitle = parseLinkedInTitle(text);
  const name = knownName || parsedTitle.name;
  let remainder = text;
  if (name) remainder = remainder.replace(new RegExp(`^${escapeRegExp(name)}\\s*-?\\s*`, "i"), "");
  remainder = remainder
    .replace(/^View\s+/i, "")
    .replace(/\s+profile\s+on\s+LinkedIn.*$/i, "")
    .replace(/\s+on\s+LinkedIn.*$/i, "");

  const segments = remainder.split(/\s+-\s+/).map(cleanText).filter(Boolean);
  const headline = segments.find((segment) => isValidHeadline(segment, name)) || "";
  const company = extractCompanyFromText(remainder) || extractCompanyFromSegments(segments, headline);
  const location = segments.find(isLikelyLocation) || extractLocationFromText(remainder);

  return { name: isValidName(name) ? name : "", headline, company, location };
}

function extractCompanyFromText(value = "") {
  const atMatch = value.match(/\bat\s+([^|.,;]+?)(?:\s+-|\s+\||,|\.|$)/i);
  const candidate = cleanText(atMatch?.[1] || "");
  return isValidCompany(candidate) ? candidate : "";
}

function extractCompanyFromSegments(segments, headline = "") {
  const candidate = [...segments]
    .reverse()
    .find((segment) => !sameText(segment, headline) && isValidCompany(segment));
  return candidate || "";
}

function extractLocationFromText(value = "") {
  const match = value.match(/\b([A-Z][A-Za-z .'-]+,\s*(?:[A-Z][A-Za-z .'-]+|India|United States|USA|UK|Canada|Australia|Remote))\b/);
  return isLikelyLocation(match?.[1] || "") ? cleanText(match[1]) : "";
}

function chooseCandidate(items, validator) {
  return firstValid(items, validator) || { value: "", source: "fallback", confidence: "low" };
}

function firstValid(items, validator) {
  const rank = { high: 3, medium: 2, low: 1 };
  return [...items]
    .map((item) => ({ ...item, value: cleanText(item.value || "") }))
    .filter((item) => item.value && validator(item.value))
    .sort((a, b) => rank[b.confidence] - rank[a.confidence])[0] || null;
}

function addCandidate(list, value, source, confidence) {
  const cleaned = stripLinkedInBadges(String(value || ""));
  if (!cleaned || cleaned === CMF_NOT_DETECTED) return;
  list.push({ value: cleaned, source, confidence });
}

function toFieldMeta(candidate, label) {
  return {
    value: candidate.value || CMF_NOT_DETECTED,
    source: candidate.value ? candidate.source : "fallback",
    confidence: candidate.value ? candidate.confidence : "low",
    label
  };
}

function summarizeCandidates(candidates) {
  return Object.fromEntries(
    Object.entries(candidates).map(([key, list]) => [key, list.slice(0, 8)])
  );
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function walkJson(value, visit, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  visit(value);
  if (Array.isArray(value)) {
    value.forEach((item) => walkJson(item, visit, seen));
    return;
  }
  Object.values(value).forEach((item) => walkJson(item, visit, seen));
}

function isPersonObject(value) {
  if (!value || typeof value !== "object") return false;
  const type = value["@type"];
  return type === "Person" || (Array.isArray(type) && type.includes("Person"));
}

function sanitizeJsonLdPerson(person) {
  return {
    "@type": person["@type"],
    name: cleanText(person.name || ""),
    jobTitle: cleanText(person.jobTitle || ""),
    description: cleanText(person.description || ""),
    worksFor: person.worksFor,
    address: person.address
  };
}

function readWorksForName(value) {
  if (Array.isArray(value)) return readWorksForName(value[0]);
  if (value && typeof value === "object") return cleanText(value.name || "");
  return "";
}

function formatAddress(value) {
  if (!value || typeof value !== "object") return "";
  const parts = [
    value.addressLocality,
    value.addressRegion,
    value.addressCountry?.name || value.addressCountry
  ].map((part) => cleanText(String(part || ""))).filter(Boolean);
  return parts.join(", ");
}

function metaContent(selector) {
  return cleanText(document.querySelector(selector)?.getAttribute("content") || "");
}

function firstVisibleText(selectors, root = document) {
  for (const selector of selectors) {
    const node = Array.from(root.querySelectorAll(selector)).find(isVisible);
    const text = stripLinkedInBadges(textOf(node));
    if (text) return text;
  }
  return "";
}

function cleanProfileUrl(value) {
  const url = new URL(value);
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "/");
}

function isLinkedInProfilePage() {
  return location.hostname.endsWith("linkedin.com") && location.pathname.includes("/in/");
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
  return String(value).replace(/\s+/g, " ").trim();
}

function stripLinkedInBadges(value = "") {
  return cleanText(value)
    .replace(/\s*(?:\u00b7|\|)\s*(1st|2nd|3rd).*$/i, "")
    .replace(/\b(1st|2nd|3rd)\b.*$/i, "")
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .trim();
}

function hasBadgeText(value = "") {
  return /\b(1st|2nd|3rd|followers?|connections?)\b/i.test(value);
}

function isValidName(value = "") {
  const text = stripLinkedInBadges(value);
  if (!text || hasBadgeText(text) || isSectionLabel(text)) return false;
  if (text.split(/\s+/).filter(Boolean).length < 2) return false;
  if (/[|@]/.test(text)) return false;
  return text.length >= 3 && text.length <= 100;
}

function isValidHeadline(value = "", name = "") {
  const text = stripLinkedInBadges(value);
  if (!text || sameText(text, name) || hasBadgeText(text)) return false;
  if (isLikelyLocation(text) || isSectionLabel(text)) return false;
  if (/^(contact info|connect|message|follow|open to|available for|view profile)$/i.test(text)) return false;
  return text.length > 3 && text.length < 220;
}

function isValidCompany(value = "") {
  const text = stripLinkedInBadges(value);
  if (!text || hasBadgeText(text) || looksLikeEducation(text) || isLikelyLocation(text) || isSectionLabel(text)) return false;
  if (/\b(past|former|previous|experience)\b/i.test(text)) return false;
  return text.length > 1 && text.length < 120;
}

function looksLikeEducation(value = "") {
  return /\b(university|college|school|b\.?a\.?|bachelor|master|mba|btech|b\.?tech|degree|education|philosophy)\b/i.test(value);
}

function isLikelyLocation(value = "") {
  const text = cleanText(value);
  if (!text || looksLikeEducation(text) || hasBadgeText(text)) return false;
  return /,\s*[A-Za-z]/.test(text) || /\b(area|region|india|united states|usa|canada|australia|remote|london|singapore|dubai|bengaluru|bangalore|mumbai|delhi|paris|berlin|toronto|sydney)\b/i.test(text);
}

function isSectionLabel(value = "") {
  return /^(experience|education|activity|posts|about|skills|licenses|certifications|recommendations|interests|current company|company|people also viewed)$/i.test(cleanText(value));
}

function isIgnoredViewportText(value = "") {
  return isSectionLabel(value) ||
    /^(home|my network|jobs|messaging|notifications|search|premium|advertise|more|save|message|connect|follow|contact info)$/i.test(cleanText(value));
}

function isMeaningfulViewportLine(value = "") {
  return cleanText(value).length > 3 && !isIgnoredViewportText(value);
}

function sameText(a = "", b = "") {
  return cleanText(a).toLowerCase() === cleanText(b).toLowerCase();
}

function escapeRegExp(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function scoreProfile(profile) {
  if (!profile) return 0;
  return [profile.name, profile.profileUrl, profile.headline, profile.currentCompany, profile.location].filter(Boolean).length;
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
