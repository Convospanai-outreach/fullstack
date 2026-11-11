import { z } from "zod";
import type { LeadFormConfig } from "./leadFormConfig";
import { decodeLeadFormMarkerId, parseLeadFormConfig } from "./leadFormConfig";
import { findLeadFormMarkers } from "./leadFormHtml";
import { getLandingRenderPayload, isSafeLink, sanitizeRenderedJsonHtml } from "./rendering";

// Maps a visitor's submission for a page with a lead form onto the lead columns and rawPayload.
// Only fields in the page's saved config are accepted, so a visitor cannot add arbitrary keys.

export const LEAD_FORM_ANSWER_MAX_CHARS = 1000;
export const LEAD_FORM_RAW_PAYLOAD_MAX_CHARS = 10000;

const COLUMN_LIMITS: Record<"name" | "phone" | "company" | "title", number> = {
  name: 200,
  phone: 50,
  company: 200,
  title: 200,
};
const EMAIL_MAX_CHARS = 320;
const emailSchema = z.string().email().max(EMAIL_MAX_CHARS);

export interface LeadFormColumns {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
}

export type LeadFormMapping =
  | { ok: true; columns: LeadFormColumns; rawPayload?: { answers: Record<string, string | boolean> } }
  | { ok: false; message: string };

function fail(message: string): LeadFormMapping {
  return { ok: false, message };
}

export function mapLeadFormSubmission(config: LeadFormConfig, formFields: Record<string, unknown> | undefined): LeadFormMapping {
  const values = formFields ?? {};
  const keys = new Set(config.fields.map((field) => field.key));
  for (const key of Object.keys(values)) {
    if (!keys.has(key)) return fail(`Unknown form field: ${key}`);
  }

  const columns: LeadFormColumns = {};
  const answers: Record<string, string | boolean> = {};
  for (const field of config.fields) {
    const raw = values[field.key];

    if (field.type === "checkbox") {
      if (raw !== undefined && typeof raw !== "boolean") return fail(`${field.label} must be true or false`);
      const checked = raw === true;
      if (field.required && !checked) return fail(`${field.label} is required`);
      answers[field.key] = checked;
      continue;
    }

    if (raw !== undefined && typeof raw !== "string") return fail(`${field.label} must be text`);
    const value = (raw ?? "").trim();
    if (!value) {
      if (field.required) return fail(`${field.label} is required`);
      continue;
    }
    if (field.type === "select" && !(field.options ?? []).includes(value)) {
      return fail(`${field.label} has an unknown option`);
    }

    if (field.key === "email") {
      if (!emailSchema.safeParse(value).success) return fail(`${field.label} must be a valid email`);
      columns.email = value;
    } else if (field.key === "name" || field.key === "phone" || field.key === "company" || field.key === "title") {
      if (value.length > COLUMN_LIMITS[field.key]) return fail(`${field.label} is too long`);
      columns[field.key] = value;
    } else {
      if (value.length > LEAD_FORM_ANSWER_MAX_CHARS) return fail(`${field.label} is too long`);
      answers[field.key] = value;
    }
  }

  if (Object.keys(answers).length === 0) return { ok: true, columns };
  if (JSON.stringify({ answers }).length > LEAD_FORM_RAW_PAYLOAD_MAX_CHARS) return fail("The answers are too long");
  return { ok: true, columns, rawPayload: { answers } };
}

// Save-time check on the page HTML as it will be served: every form marker must decode to a valid
// config, and its redirect must pass the server link check. Returns an error message, or null.
export function leadFormMarkerError(renderedJson: unknown): string | null {
  const html = getLandingRenderPayload(sanitizeRenderedJsonHtml(renderedJson)).html;
  // Only the first marker renders; a later one (for example a copy GrapesJS renamed) is ignored.
  const first = findLeadFormMarkers(html)[0];
  if (!first) return null;
  const config = decodeLeadFormMarkerId(first.id);
  if (!config || !parseLeadFormConfig(config)) return "A form block has an invalid configuration. Check its fields, button and success message.";
  if (config.redirectUrl && !isSafeLink(config.redirectUrl)) return "A form block redirect must be an https link.";
  return null;
}
