export interface TitleMetaFallbackInput {
  title?: string;
  ogTitle?: string;
  metaDescription?: string;
  ogDescription?: string;
}

export function parseTitleMetaFallback(input: TitleMetaFallbackInput) {
  const rawTitle = cleanText(input.ogTitle || input.title || "");
  const rawDescription = cleanText(input.metaDescription || input.ogDescription || "");
  const parsed = parseLinkedInTitle(rawTitle);
  const name = isValidName(parsed.name) ? parsed.name : "";
  const headline = isValidHeadline(parsed.headline, name)
    ? parsed.headline
    : cleanFallbackHeadline(rawDescription, name);

  return { name, headline };
}

export function parseLinkedInTitle(value = "") {
  const title = stripLinkedInBadges(value).replace(/\s*\|\s*LinkedIn\s*$/i, "");
  const parts = title.split(" - ").map(cleanText).filter(Boolean);
  return {
    name: parts[0] || "",
    headline: parts.length > 1 ? parts.slice(1).join(" - ") : ""
  };
}

export function stripLinkedInBadges(value = ""): string {
  return cleanText(value)
    .replace(/\s*(?:·|Â·|\|)\s*(1st|2nd|3rd).*$/i, "")
    .replace(/\b(1st|2nd|3rd)\b.*$/i, "")
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .trim();
}

export function isValidCompany(value = ""): boolean {
  const text = stripLinkedInBadges(value);
  if (!text || hasBadgeText(text) || looksLikeEducation(text) || isLikelyLocation(text)) return false;
  return text.length > 1 && text.length < 120;
}

function cleanFallbackHeadline(value = "", name = "") {
  const text = stripLinkedInBadges(value);
  if (!text || sameText(text, name) || looksLikeEducation(text)) return "";
  const withoutPrefix = text
    .replace(/^View\s+/i, "")
    .replace(name ? new RegExp(`^${escapeRegExp(name)}\\s+`, "i") : /^$/, "")
    .replace(/\s+on LinkedIn\.?.*$/i, "")
    .trim();
  return isValidHeadline(withoutPrefix, name) ? withoutPrefix : "";
}

function isValidName(value = "") {
  const text = stripLinkedInBadges(value);
  if (!text || hasBadgeText(text)) return false;
  return text.split(/\s+/).length >= 2 && text.length <= 100;
}

function isValidHeadline(value = "", name = "") {
  const text = stripLinkedInBadges(value);
  if (!text || sameText(text, name) || hasBadgeText(text)) return false;
  if (isLikelyLocation(text) || looksLikeEducation(text)) return false;
  return text.length > 3 && text.length < 220;
}

function hasBadgeText(value = "") {
  return /\b(1st|2nd|3rd|followers?|connections?)\b/i.test(value);
}

function looksLikeEducation(value = "") {
  return /\b(university|college|school|b\.?a\.?|bcom|b\.?tech|mba|philosophy|education|degree)\b/i.test(value);
}

function isLikelyLocation(value = "") {
  return /,\s*[A-Za-z]/.test(value) || /\b(area|region|india|united states|remote)\b/i.test(value);
}

function sameText(a = "", b = "") {
  return cleanText(a).toLowerCase() === cleanText(b).toLowerCase();
}

function cleanText(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
