import {
  decodeLeadFormMarkerId,
  LEAD_FORM_MARKER_CLASS,
  LEAD_FORM_MARKER_ID_PREFIX,
  parseLeadFormConfig,
  type LeadFormConfig,
  type LeadFormField,
} from "./leadFormConfig";

// Builds the lead form HTML from a validated config and finds the form marker in page HTML.
// The API copy (apps/api/src/modules/landing-agent/leadFormHtml.ts) must stay identical; both apps
// test the output against tests/fixtures/lead-form-parity.json.
// Only the FIRST marker in a page renders a form. Later markers and invalid markers render nothing.

export interface LeadFormMarker {
  start: number;
  end: number;
  id: string;
}

export interface LeadFormHtmlOptions {
  slug: string;
  // Creator funnel pages: the WhatsApp opt-in text, or null for none.
  whatsappOptIn?: string | null;
}

export function escapeLeadFormHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// The sanitizer re-serializes markers as `<div attr="value"...></div>` with double-quoted values.
const EMPTY_DIV_PATTERN = /<div\s([^>]*)><\/div>/gi;
const ATTR_PATTERN = /([a-zA-Z-]+)="([^"]*)"/g;

export function findLeadFormMarkers(html: string): LeadFormMarker[] {
  const markers: LeadFormMarker[] = [];
  for (const match of html.matchAll(EMPTY_DIV_PATTERN)) {
    const attrs: Record<string, string> = {};
    for (const attr of match[1].matchAll(ATTR_PATTERN)) attrs[attr[1].toLowerCase()] = attr[2];
    const classes = (attrs["class"] ?? "").split(/\s+/);
    const id = attrs["id"] ?? "";
    if (classes.includes(LEAD_FORM_MARKER_CLASS) && id.startsWith(LEAD_FORM_MARKER_ID_PREFIX)) {
      markers.push({ start: match.index, end: match.index + match[0].length, id });
    }
  }
  return markers;
}

export function hasLeadFormMarker(html: string): boolean {
  return findLeadFormMarkers(html).length > 0;
}

// The config of the first marker, or null when there is no marker or it is invalid.
export function readLeadFormConfig(html: string): LeadFormConfig | null {
  const first = findLeadFormMarkers(html)[0];
  return first ? decodeLeadFormMarkerId(first.id) : null;
}

function renderField(field: LeadFormField): string {
  const name = field.key;
  const label = escapeLeadFormHtml(field.label);
  const required = field.required ? " required" : "";
  if (field.type === "checkbox") {
    return `<label style="display:flex;gap:8px;align-items:flex-start;font-size:14px"><input type="checkbox" name="${name}" aria-label="${label}" style="margin-top:3px"${required} />${label}</label>`;
  }
  if (field.type === "select") {
    const options = (field.options ?? [])
      .map((option) => `<option value="${escapeLeadFormHtml(option)}">${escapeLeadFormHtml(option)}</option>`)
      .join("");
    return `<select name="${name}" aria-label="${label}"${required}><option value="">${label}</option>${options}</select>`;
  }
  if (field.type === "textarea") {
    return `<textarea name="${name}" placeholder="${label}" aria-label="${label}" rows="4"${required}></textarea>`;
  }
  return `<input type="${field.type}" name="${name}" placeholder="${label}" aria-label="${label}"${required} />`;
}

// Returns "" for an invalid config, so a bad marker renders nothing.
export function buildLeadFormHtml(config: LeadFormConfig, options: LeadFormHtmlOptions, anchor = true): string {
  const valid = parseLeadFormConfig(config);
  if (!valid) return "";
  const redirect = valid.redirectUrl ? ` data-redirect="${escapeLeadFormHtml(valid.redirectUrl)}"` : "";
  const whatsapp = options.whatsappOptIn
    ? `<label style="display:flex;gap:8px;align-items:flex-start;font-size:14px"><input type="checkbox" name="whatsappConsent" aria-label="${escapeLeadFormHtml(options.whatsappOptIn)}" style="margin-top:3px" />${escapeLeadFormHtml(options.whatsappOptIn)}</label>`
    : "";
  return `
<section class="la-section" style="max-width:640px;margin:40px auto">
    ${anchor ? `<span id="lead-form"></span>` : ""}
    <form id="la-lead-form" data-cmf-form="1"${redirect} action="/${escapeLeadFormHtml(options.slug)}/lead" method="post" style="display:grid;gap:12px;margin-top:16px">
        ${valid.fields.map(renderField).join("\n        ")}${whatsapp}
        <input type="text" name="website" tabindex="-1" autocomplete="off" style="display:none" />
        <button type="submit" class="la-cta">${escapeLeadFormHtml(valid.buttonLabel)}</button>
    </form>
    <p id="la-lead-form-status" style="color:#e11d48;font-size:14px"></p>
</section>`;
}

// Replaces the first marker with its form and removes any other markers.
export function replaceLeadFormMarkers(html: string, options: LeadFormHtmlOptions): string {
  const markers = findLeadFormMarkers(html);
  if (markers.length === 0) return html;
  let out = "";
  let cursor = 0;
  markers.forEach((marker, index) => {
    out += html.slice(cursor, marker.start);
    if (index === 0) {
      const config = decodeLeadFormMarkerId(marker.id);
      if (config) out += buildLeadFormHtml(config, options, true);
    }
    cursor = marker.end;
  });
  return out + html.slice(cursor);
}
