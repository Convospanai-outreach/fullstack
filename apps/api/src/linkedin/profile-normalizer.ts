import type { CMFProspect, ProspectCaptureMethod } from "../prospects/prospect.types";

export interface NormalizeLinkedInProfileOptions {
  captureMethod?: ProspectCaptureMethod;
  capturedAt?: string;
}

export function normalizeLinkedInProfileObject(
  value: unknown,
  options: NormalizeLinkedInProfileOptions = {}
): CMFProspect {
  const record = isRecord(value) ? value : {};
  const publicIdentifier = cleanIdentifier(readString(record, "publicIdentifier"));
  const entityUrn = cleanText(readString(record, "entityUrn"));
  const firstName = cleanPersonName(readString(record, "firstName"));
  const lastName = cleanPersonName(readString(record, "lastName"));
  const fullName = cleanPersonName(readString(record, "fullName")) || joinName(firstName, lastName);
  const headline = cleanHeadline(readString(record, "headline"));
  const occupation = cleanHeadline(readString(record, "occupation"));
  const location = cleanLocation(readString(record, "locationName") || readString(record, "geoLocationName"));
  const profilePicture = getProfilePicture(record);
  const memberId = extractMemberId(entityUrn || readString(record, "memberIdentity"));

  return compactProspect({
    source: "linkedin",
    profileUrl: normalizeLinkedInProfileUrl(publicIdentifier || readString(record, "profileUrl")),
    publicIdentifier,
    entityUrn,
    linkedinId: memberId,
    memberId,
    firstName,
    lastName,
    fullName,
    headline,
    occupation,
    companyName: cleanCompanyName(readString(record, "companyName")),
    location,
    profilePicture,
    captureMethod: options.captureMethod || "linkedin_api_payload",
    capturedAt: options.capturedAt || new Date().toISOString()
  });
}

export function normalizeLinkedInProfileUrl(value = ""): string {
  const cleaned = value.trim();
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const url = new URL(cleaned);
      const match = url.pathname.match(/\/in\/([^/?#]+)/i);
      return match ? `https://www.linkedin.com/in/${match[1]}/` : cleaned;
    } catch {
      return "";
    }
  }
  return `https://www.linkedin.com/in/${cleanIdentifier(cleaned)}/`;
}

export function stripLinkedInBadges(value = ""): string {
  return cleanText(value)
    .replace(/\s*(?:·|Â·|\|)\s*(1st|2nd|3rd).*$/i, "")
    .replace(/\b(1st|2nd|3rd)\b.*$/i, "")
    .replace(/\s*\|\s*LinkedIn\s*$/i, "")
    .trim();
}

export function cleanCompanyName(value = ""): string {
  const cleaned = stripLinkedInBadges(value);
  if (!cleaned || looksLikeEducation(cleaned) || looksLikeLocation(cleaned)) return "";
  return cleaned.length <= 120 ? cleaned : "";
}

function cleanHeadline(value = ""): string {
  const cleaned = stripLinkedInBadges(value);
  if (!cleaned || looksLikeEducationOnly(cleaned) || looksLikeLocation(cleaned)) return "";
  return cleaned.length <= 220 ? cleaned : "";
}

function cleanLocation(value = ""): string {
  const cleaned = stripLinkedInBadges(value);
  if (!cleaned || !looksLikeLocation(cleaned)) return "";
  return cleaned.length <= 120 ? cleaned : "";
}

function cleanPersonName(value = ""): string {
  const cleaned = stripLinkedInBadges(value);
  if (!cleaned || cleaned.length > 100) return "";
  return cleaned;
}

function getProfilePicture(record: Record<string, unknown>): string {
  const picture = record.profilePicture || record.picture;
  const vector = readNestedRecord(picture, ["displayImageReference", "vectorImage"]) || (isRecord(picture) ? picture : null);
  const rootUrl = readString(vector || {}, "rootUrl");
  const artifacts = isRecord(vector) && Array.isArray(vector.artifacts) ? vector.artifacts : [];
  const artifact = artifacts
    .filter(isRecord)
    .sort((a, b) => Number(b.width || 0) - Number(a.width || 0))[0];
  const path = artifact ? readString(artifact, "fileIdentifyingUrlPathSegment") : "";
  return rootUrl && path ? `${rootUrl}${path}` : "";
}

function extractMemberId(value = ""): string {
  const match = value.match(/(?:member|profile):(?:ACo)?([^,)]+)/i) || value.match(/\(([^,)]+),/);
  return cleanIdentifier(match?.[1] || "");
}

function cleanIdentifier(value = ""): string {
  return value.trim().replace(/^\/?in\//i, "").replace(/[/?#].*$/, "");
}

function joinName(firstName = "", lastName = ""): string {
  return [firstName, lastName].filter(Boolean).join(" ");
}

function cleanText(value = ""): string {
  return value.replace(/\s+/g, " ").trim();
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readNestedRecord(value: unknown, keys: string[]): Record<string, unknown> | null {
  let current: unknown = value;
  for (const key of keys) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return isRecord(current) ? current : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function compactProspect(prospect: CMFProspect): CMFProspect {
  return Object.fromEntries(
    Object.entries(prospect).filter(([, value]) => value !== "")
  ) as CMFProspect;
}

function looksLikeEducation(value = ""): boolean {
  return /\b(university|college|school|b\.?a\.?|bcom|b\.?tech|mba|philosophy|education|degree)\b/i.test(value);
}

function looksLikeEducationOnly(value = ""): boolean {
  return looksLikeEducation(value) && !/\bat\b|\b@\b|\bengineer\b|\bmanager\b|\bfounder\b|\bdesigner\b|\bdeveloper\b/i.test(value);
}

function looksLikeLocation(value = ""): boolean {
  return /,\s*[A-Za-z]/.test(value) || /\b(area|region|india|united states|remote)\b/i.test(value);
}
