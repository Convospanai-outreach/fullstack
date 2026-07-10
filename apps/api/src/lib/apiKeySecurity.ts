import { randomBytes } from "node:crypto";

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

export const NEW_API_KEY_PREFIX = "cmf_live_";
export const API_KEY_SECRET_BYTES = 32;
const NEW_API_KEY_PATTERN = /^cmf_live_[a-f0-9]{64}$/;
const LEGACY_API_KEY_PATTERN = /^((?:cs|sk)_live_)[a-f0-9]{48}$/;

export const DEFAULT_API_KEY_SCOPES: readonly ApiKeyScope[] = ["leads:read"];

export type ApiKeyDisplayMetadata = {
  keyPrefix: string;
  keyLastFour: string | null;
  legacy: boolean;
};

export class ApiKeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiKeyValidationError";
  }
}

export function isValidNewApiKeyFormat(value: string): boolean {
  return NEW_API_KEY_PATTERN.test(value);
}

export function isValidLegacyApiKeyFormat(value: string): boolean {
  return LEGACY_API_KEY_PATTERN.test(value);
}

export function isValidPresentedApiKey(value: string): boolean {
  return isValidNewApiKeyFormat(value) || isValidLegacyApiKeyFormat(value);
}

export function createApiKeySecret() {
  const secret = NEW_API_KEY_PREFIX + randomBytes(API_KEY_SECRET_BYTES).toString("hex");

  return {
    secret,
    keyPrefix: NEW_API_KEY_PREFIX,
    keyLastFour: secret.slice(-4),
  };
}

export function getApiKeyDisplayMetadata(value: string): ApiKeyDisplayMetadata {
  if (isValidNewApiKeyFormat(value)) {
    return {
      keyPrefix: NEW_API_KEY_PREFIX,
      keyLastFour: value.slice(-4),
      legacy: false,
    };
  }

  const legacy = value.match(LEGACY_API_KEY_PATTERN);
  if (legacy) {
    return {
      keyPrefix: legacy[1],
      keyLastFour: value.slice(-4),
      legacy: true,
    };
  }

  return {
    keyPrefix: "unknown_",
    keyLastFour: null,
    legacy: false,
  };
}

export function validateApiKeyScopes(input: unknown): ApiKeyScope[] {
  if (input === undefined) {
    return [...DEFAULT_API_KEY_SCOPES];
  }

  if (
    !Array.isArray(input)
    || input.length === 0
    || input.length > API_KEY_SCOPE_ALLOWLIST.length
    || input.some((scope) => typeof scope !== "string")
  ) {
    throw new ApiKeyValidationError("Invalid API key scopes");
  }

  const scopes = input as string[];
  if (new Set(scopes).size !== scopes.length) {
    throw new ApiKeyValidationError("Duplicate API key scopes are not allowed");
  }

  if (scopes.some((scope) => !API_KEY_SCOPE_SET.has(scope))) {
    throw new ApiKeyValidationError("Unknown API key scope");
  }

  return [...scopes] as ApiKeyScope[];
}
