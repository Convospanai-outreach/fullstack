import { z } from "zod";

// Lead form config shared by the editor and the renderers. The API copy of this file
// (apps/api/src/modules/landing-agent/leadFormConfig.ts) must stay identical; both apps
// test it against tests/fixtures/lead-form-config.json.

export const LEAD_FORM_MAX_FIELDS = 8;
export const LEAD_FORM_FIELD_TYPES = ["text", "email", "tel", "textarea", "select", "checkbox"] as const;
export const LEAD_FORM_MARKER_CLASS = "cmf-form";
export const LEAD_FORM_MARKER_ID_PREFIX = "cmf-form-";
export const LEAD_FORM_MAX_MARKER_ID_LENGTH = 2000;
// Instagram handle for the thank-you page's follow button: 1 to 30 letters, digits, dots or underscores.
export const INSTAGRAM_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;
export const INSTAGRAM_HANDLE_MESSAGE = "Instagram handle: 1 to 30 letters, numbers, dots or underscores (no @ and no link)";

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const MARKER_PAYLOAD_PATTERN = /^[A-Za-z0-9_-]+$/;

const fieldSchema = z
  .object({
    key: z.string().regex(KEY_PATTERN),
    label: z.string().trim().min(1).max(80),
    type: z.enum(LEAD_FORM_FIELD_TYPES),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(80)).min(1).max(10).optional(),
  })
  .strict()
  .superRefine((field, ctx) => {
    if (field.type === "select" && !field.options) {
      ctx.addIssue({ code: "custom", message: "select fields need options", path: ["options"] });
    }
    if (field.type !== "select" && field.options) {
      ctx.addIssue({ code: "custom", message: "only select fields take options", path: ["options"] });
    }
    // Keys map to lead columns by name, so an email-type field must be keyed `email`.
    if (field.type === "email" && field.key !== "email") {
      ctx.addIssue({ code: "custom", message: "an email field must use the key email", path: ["key"] });
    }
  });

export function isSafeRedirectUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export const leadFormConfigSchema = z
  .object({
    fields: z.array(fieldSchema).min(1).max(LEAD_FORM_MAX_FIELDS),
    buttonLabel: z.string().trim().min(1).max(40),
    successMessage: z.string().trim().min(1).max(300),
    instagramHandle: z.string().regex(INSTAGRAM_HANDLE_PATTERN, { message: INSTAGRAM_HANDLE_MESSAGE }).optional(),
    redirectUrl: z
      .string()
      .trim()
      .max(2048)
      .refine(isSafeRedirectUrl, { message: "redirect must be an https URL" })
      .optional(),
    bookingUrl: z
      .string()
      .trim()
      .max(500)
      .refine(isSafeRedirectUrl, { message: "booking link must be an https URL" })
      .optional(),
  })
  .strict()
  .superRefine((config, ctx) => {
    const keys = config.fields.map((field) => field.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({ code: "custom", message: "field keys must be unique", path: ["fields"] });
    }
    const hasEmail = config.fields.some((field) => field.key === "email");
    const hasTel = config.fields.some((field) => field.type === "tel");
    if (!hasEmail && !hasTel) {
      ctx.addIssue({ code: "custom", message: "add an email field (or a phone field)", path: ["fields"] });
    }
  });

export type LeadFormField = z.infer<typeof fieldSchema>;
export type LeadFormConfig = z.infer<typeof leadFormConfigSchema>;

// Returns the parsed config, or null when anything about it is invalid.
export function parseLeadFormConfig(value: unknown): LeadFormConfig | null {
  const result = leadFormConfigSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function isValidInstagramHandle(value: unknown): value is string {
  return typeof value === "string" && INSTAGRAM_HANDLE_PATTERN.test(value);
}

// The message for a handle that is not usable, or null when it is valid.
export function instagramHandleProblem(value: string): string | null {
  return isValidInstagramHandle(value) ? null : INSTAGRAM_HANDLE_MESSAGE;
}

// The profile link built from a validated handle only, or null.
export function instagramProfileUrl(handle: string): string | null {
  return isValidInstagramHandle(handle) ? `https://www.instagram.com/${handle}/` : null;
}

// Plain base64url without padding; TextEncoder/atob work in browsers and in Node 18+.
function toBase64Url(text: string): string {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(payload: string): string {
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (payload.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

// The marker is the `id` of an empty `<div class="cmf-form">`. The sanitizer keeps `id` and
// `class` but no data-* attributes, so the config travels in the id. Validated on encode and decode.
export function encodeLeadFormMarkerId(config: LeadFormConfig): string {
  const parsed = parseLeadFormConfig(config);
  if (!parsed) throw new Error("invalid lead form config");
  const id = LEAD_FORM_MARKER_ID_PREFIX + toBase64Url(JSON.stringify(parsed));
  if (id.length > LEAD_FORM_MAX_MARKER_ID_LENGTH) throw new Error("lead form config is too large");
  return id;
}

export function decodeLeadFormMarkerId(id: string): LeadFormConfig | null {
  if (!id.startsWith(LEAD_FORM_MARKER_ID_PREFIX) || id.length > LEAD_FORM_MAX_MARKER_ID_LENGTH) return null;
  const payload = id.slice(LEAD_FORM_MARKER_ID_PREFIX.length);
  if (!payload || !MARKER_PAYLOAD_PATTERN.test(payload)) return null;
  try {
    return parseLeadFormConfig(JSON.parse(fromBase64Url(payload)));
  } catch {
    return null;
  }
}
