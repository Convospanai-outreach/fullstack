import { FEATURE_FLAGS } from "../config/feature-flags";

export type LinkedInRequestType =
  | "graphql"
  | "identity"
  | "search"
  | "sales_people_search"
  | "sales_lead_search"
  | "regular_v3_profile"
  | "regular_v3_search"
  | "unknown";

export interface RequestMetadata {
  url: string;
  method: string;
  requestType: LinkedInRequestType;
  capturedAt: string;
}

export interface RecordedLinkedInRequest extends RequestMetadata {
  redactedHeaders?: Record<string, string>;
  redactedBody?: string;
}

export class LinkedInRequestRecorder {
  private readonly entries: RecordedLinkedInRequest[] = [];

  classifyUrl(value: string): LinkedInRequestType {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return "unknown";
    }

    if (!isLinkedInHost(url.hostname)) return "unknown";
    const haystack = `${url.pathname}${url.search}`;

    if (haystack.includes("/voyager/api/graphql")) return "graphql";
    if (haystack.includes("/voyager/api/identity")) return "identity";
    if (haystack.includes("/voyager/api/search")) return "search";
    if (/salesApiPeopleSearch/i.test(haystack)) return "sales_people_search";
    if (/salesApiLeadSearch/i.test(haystack)) return "sales_lead_search";
    if (/regularV3.*profile|profile.*regularV3/i.test(haystack)) return "regular_v3_profile";
    if (/regularV3.*search|search.*regularV3/i.test(haystack)) return "regular_v3_search";
    return "unknown";
  }

  record(input: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }): RecordedLinkedInRequest | null {
    // Disabled until the V2 Chrome Web Store and privacy review approves API-assisted capture.
    if (!FEATURE_FLAGS.linkedinApiCapture) return null;

    const requestType = this.classifyUrl(input.url);
    if (requestType === "unknown") return null;

    const entry: RecordedLinkedInRequest = {
      url: input.url,
      method: input.method || "GET",
      requestType,
      capturedAt: new Date().toISOString(),
      redactedHeaders: redactHeaders(input.headers || {}),
      redactedBody: input.body ? redactBody(input.body) : undefined
    };

    this.entries.push(entry);
    return entry;
  }

  getEntries(): RecordedLinkedInRequest[] {
    return [...this.entries];
  }
}

function isLinkedInHost(hostname: string): boolean {
  return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
}

function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers)
      .filter(([key]) => !/^(cookie|authorization|x-li-track|csrf-token|x-restli-protocol-version)$/i.test(key))
      .map(([key, value]) => [key, redactSensitiveValue(value)])
  );
}

function redactBody(body: string): string {
  return body
    .replace(/("?(?:csrf|token|password|cookie|authorization)"?\s*[:=]\s*)("[^"]+"|[^&,\s}]+)/gi, "$1[REDACTED]")
    .slice(0, 2000);
}

function redactSensitiveValue(value: string): string {
  return /csrf|token|password|cookie|authorization/i.test(value) ? "[REDACTED]" : value;
}
