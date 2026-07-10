import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const API_KEY_SCOPE_ALLOWLIST = [
  "agents:read",
  "agents:write",
  "campaigns:read",
  "campaigns:write",
  "leads:read",
  "leads:write",
  "tasks:read",
  "tasks:write",
  "workflows:read",
  "workflows:write",
  "workflows:run",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPE_ALLOWLIST)[number];

const API_KEY_SCOPE_SET = new Set<string>(API_KEY_SCOPE_ALLOWLIST);
const NEW_API_KEY_PREFIX = "cmf_live_";
const NEW_API_KEY_PATTERN = /^cmf_live_[a-f0-9]{64}$/;
const LEGACY_API_KEY_PATTERN = /^(?:cs|sk)_live_[a-f0-9]{48}$/;
const STORED_LOOKUP_PATTERN = /^v2:([a-f0-9]{64}):([a-f0-9]{4})$/;

export const DEFAULT_API_KEY_SCOPES: readonly ApiKeyScope[] = ["leads:read"];
export const API_KEY_MAX_ACTIVE_PER_TEAM = 20;
export const API_KEY_LIST_DEFAULT_LIMIT = 20;
export const API_KEY_LIST_MAX_LIMIT = 100;
export const API_KEY_LIST_MAX_OFFSET = 10_000;
export const API_KEY_AUTH_RATE_LIMIT = {
  windowMs: 60_000,
  maxRequests: 60,
} as const;

// Legacy raw records are upgraded on successful use until this explicit date.
export const LEGACY_API_KEY_RETIREMENT_DATE = new Date("2026-10-31T00:00:00.000Z");

export class ApiKeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyValidationError";
  }
}

export class ApiKeyLimitError extends Error {
  constructor() {
    super("Active API key limit reached");
    this.name = "ApiKeyLimitError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function constantTimeEquals(left: string, right: string): boolean {
  const leftDigest = createHash("sha256").update(left).digest();
  const rightDigest = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

export function isValidPresentedApiKey(value: string): boolean {
  return NEW_API_KEY_PATTERN.test(value) || LEGACY_API_KEY_PATTERN.test(value);
}

export function isStoredApiKeyLookup(value: string): boolean {
  return STORED_LOOKUP_PATTERN.test(value);
}

export function isLegacyStoredApiKey(value: string): boolean {
  return !isStoredApiKeyLookup(value);
}

export function createApiKeyLookup(rawKey: string): string {
  if (!isValidPresentedApiKey(rawKey)) {
    throw new ApiKeyValidationError("Invalid API key format");
  }

  return `v2:${sha256(rawKey)}:${rawKey.slice(-4).toLowerCase()}`;
}

export function createApiKeySecret() {
  const secret = `${NEW_API_KEY_PREFIX}${randomBytes(32).toString("hex")}`;
  return {
    secret,
    lookup: createApiKeyLookup(secret),
    keyPrefix: NEW_API_KEY_PREFIX,
    keyLastFour: secret.slice(-4),
  };
}

export function getApiKeyDisplayMetadata(storedValue: string) {
  const storedLookup = storedValue.match(STORED_LOOKUP_PATTERN);
  if (storedLookup) {
    return {
      keyPrefix: NEW_API_KEY_PREFIX,
      keyLastFour: storedLookup[2],
      legacy: false,
    };
  }

  const legacy = storedValue.match(/^((?:cs|sk)_live_)[a-f0-9]{48}$/);
  return {
    keyPrefix: legacy?.[1] ?? "legacy_",
    keyLastFour: legacy ? storedValue.slice(-4) : null,
    legacy: true,
  };
}

export function parseApiKeyCreationInput(input: unknown): {
  name: string;
  scopes: ApiKeyScope[];
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiKeyValidationError("Invalid API key request");
  }

  const payload = input as Record<string, unknown>;
  const allowedFields = new Set(["name", "scopes"]);
  if (Object.keys(payload).some((field) => !allowedFields.has(field))) {
    throw new ApiKeyValidationError("Invalid API key request");
  }

  if (typeof payload.name !== "string") {
    throw new ApiKeyValidationError("A key name is required");
  }

  const name = payload.name.trim();
  if (name.length < 1 || name.length > 80) {
    throw new ApiKeyValidationError("API key name must be between 1 and 80 characters");
  }

  const requestedScopes = payload.scopes === undefined
    ? [...DEFAULT_API_KEY_SCOPES]
    : payload.scopes;

  if (!Array.isArray(requestedScopes) || requestedScopes.length === 0 || requestedScopes.length > API_KEY_SCOPE_ALLOWLIST.length) {
    throw new ApiKeyValidationError("Invalid API key scopes");
  }

  if (requestedScopes.some((scope) => typeof scope !== "string")) {
    throw new ApiKeyValidationError("Invalid API key scopes");
  }

  const scopes = requestedScopes as string[];
  if (new Set(scopes).size !== scopes.length) {
    throw new ApiKeyValidationError("Duplicate API key scopes are not allowed");
  }

  if (scopes.some((scope) => !API_KEY_SCOPE_SET.has(scope))) {
    throw new ApiKeyValidationError("Unknown API key scope");
  }

  return { name, scopes: scopes as ApiKeyScope[] };
}

function parseBoundedInteger(
  rawValue: string | null,
  defaultValue: number,
  maximum: number,
  label: string
): number {
  if (rawValue === null) {
    return defaultValue;
  }

  if (!/^(?:0|[1-9][0-9]*)$/.test(rawValue)) {
    throw new ApiKeyValidationError(`Invalid ${label}`);
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value)) {
    throw new ApiKeyValidationError(`Invalid ${label}`);
  }

  return Math.min(value, maximum);
}

export function parseApiKeyListPagination(url: URL) {
  const limit = parseBoundedInteger(
    url.searchParams.get("limit"),
    API_KEY_LIST_DEFAULT_LIMIT,
    API_KEY_LIST_MAX_LIMIT,
    "limit"
  );
  const offset = parseBoundedInteger(
    url.searchParams.get("offset"),
    0,
    API_KEY_LIST_MAX_OFFSET,
    "offset"
  );

  return { limit, offset };
}

export function hasRequiredApiKeyScope(
  scopes: readonly string[],
  requiredScope: string | undefined,
  isLegacyKey: boolean,
  now = new Date()
): boolean {
  if (!requiredScope) {
    return true;
  }

  if (!API_KEY_SCOPE_SET.has(requiredScope)) {
    return false;
  }

  if (scopes.includes(requiredScope)) {
    return true;
  }

  // Existing legacy admin keys remain usable only during the documented transition.
  return isLegacyKey
    && now < LEGACY_API_KEY_RETIREMENT_DATE
    && scopes.includes("admin");
}

export function getApiKeyAuthRateLimitIdentifier(rawKey: string): string {
  return `api-key-auth:${sha256(rawKey)}`;
}
