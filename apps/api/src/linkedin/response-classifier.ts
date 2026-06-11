const MINI_PROFILE_TYPE = "com.linkedin.voyager.identity.shared.MiniProfile";
const DASH_PROFILE_TYPE = "com.linkedin.voyager.dash.identity.profile.Profile";

export function isMiniProfilePayload(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  return payload.$type === MINI_PROFILE_TYPE ||
    (typeof payload.publicIdentifier === "string" &&
      typeof payload.entityUrn === "string" &&
      (typeof payload.firstName === "string" || typeof payload.lastName === "string"));
}

export function isLinkedInProfilePayload(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  return payload.$type === DASH_PROFILE_TYPE ||
    isMiniProfilePayload(payload) ||
    (typeof payload.publicIdentifier === "string" &&
      (typeof payload.headline === "string" || typeof payload.occupation === "string"));
}

export function findMiniProfiles(payload: unknown): unknown[] {
  return findLinkedInObjects(payload, isMiniProfilePayload);
}

export function findProfileObjects(payload: unknown): unknown[] {
  return findLinkedInObjects(payload, isLinkedInProfilePayload);
}

function findLinkedInObjects(payload: unknown, predicate: (value: unknown) => boolean): unknown[] {
  const found: unknown[] = [];
  const seen = new Set<unknown>();

  function visit(value: unknown): void {
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);

    if (predicate(value)) {
      found.push(value);
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    Object.values(value as Record<string, unknown>).forEach(visit);
  }

  visit(payload);
  return found;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
