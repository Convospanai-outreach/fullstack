// Pure logic for the editor's lead form block and its settings panel. The panel and GrapesEditor
// only call these functions. The config lives in the marker's id (see leadFormConfig.ts).
import {
    decodeLeadFormMarkerId,
    encodeLeadFormMarkerId,
    LEAD_FORM_MARKER_CLASS,
    LEAD_FORM_MARKER_ID_PREFIX,
    LEAD_FORM_CONSENT_DEFAULT_TEXT,
    LEAD_FORM_DEFAULT_CONSENT,
    LEAD_FORM_MAX_FIELDS,
    leadFormConfigSchema,
    type LeadFormConfig,
    type LeadFormConsent,
    type LeadFormField,
} from "@/modules/landing-agent/leadFormConfig";
import { replaceLeadFormMarkers } from "@/modules/landing-agent/leadFormHtml";

export const LEAD_FORM_DEFAULT_CONFIG: LeadFormConfig = {
    fields: [{ key: "email", label: "Work email", type: "email", required: true }],
    buttonLabel: "Send it to me",
    successMessage: "Thanks! Check your inbox.",
    consent: LEAD_FORM_DEFAULT_CONSENT,
};

// The block the editor inserts. The marker is empty; the form is built from its config when the page renders.
export function leadFormBlockContent(): string {
    return `
<section class="la-section">
    <div class="${LEAD_FORM_MARKER_CLASS}" id="${encodeLeadFormMarkerId(LEAD_FORM_DEFAULT_CONFIG)}"></div>
</section>`;
}

// Canvas only (added to the editor frame, never to the published page): shows the empty marker as a box.
export const LEAD_FORM_CANVAS_CSS = `.${LEAD_FORM_MARKER_CLASS} { min-height: 96px; max-width: 640px; margin: 24px auto; display: flex; align-items: center; justify-content: center; border: 2px dashed #22d3ee; border-radius: 12px; }
.${LEAD_FORM_MARKER_CLASS}::before { content: "Lead form (see the Live Preview for the form)"; color: #475569; font-size: 14px; }`;

// The lead form of a selected component: { config } for a lead form (config null when its id
// no longer decodes, so the panel can offer a reset), or null for anything else.
export function leadFormOfSelection(selection: { id: string; classes: string[] }): { config: LeadFormConfig | null } | null {
    if (!selection.classes.includes(LEAD_FORM_MARKER_CLASS)) return null;
    if (!selection.id.startsWith(LEAD_FORM_MARKER_ID_PREFIX)) return null;
    return { config: decodeLeadFormMarkerId(selection.id) };
}

// The first problem with a config, in words for the panel, or null when it can be saved.
export function leadFormProblem(config: LeadFormConfig): string | null {
    const result = leadFormConfigSchema.safeParse(config);
    if (!result.success) {
        const issue = result.error.issues[0];
        return issue ? issue.message : "This form is not valid";
    }
    // The config is saved in the block's id, which has a length cap.
    try {
        encodeLeadFormMarkerId(config);
        return null;
    } catch {
        return "This form is too large to save. Shorten the consent steps or the other text.";
    }
}

export function addLeadFormField(config: LeadFormConfig): LeadFormConfig {
    if (config.fields.length >= LEAD_FORM_MAX_FIELDS) return config;
    const used = new Set(config.fields.map((field) => field.key));
    let n = 1;
    while (used.has(`field_${n}`)) n++;
    const field: LeadFormField = { key: `field_${n}`, label: "New field", type: "text", required: false };
    return { ...config, fields: [...config.fields, field] };
}

export function removeLeadFormField(config: LeadFormConfig, index: number): LeadFormConfig {
    return { ...config, fields: config.fields.filter((_, i) => i !== index) };
}

export function moveLeadFormField(config: LeadFormConfig, index: number, delta: -1 | 1): LeadFormConfig {
    const target = index + delta;
    if (target < 0 || target >= config.fields.length) return config;
    const fields = [...config.fields];
    [fields[index], fields[target]] = [fields[target]!, fields[index]!];
    return { ...config, fields };
}

// Changing type keeps options only for select; a select gets one default option. A Phone or Email
// field takes the key phone or email (when no other field has it), so it fills the lead's column.
export function updateLeadFormField(config: LeadFormConfig, index: number, patch: Partial<LeadFormField>): LeadFormConfig {
    const fields = config.fields.map((field, i) => {
        if (i !== index) return field;
        const next: LeadFormField = { ...field, ...patch };
        if (patch.type !== undefined && patch.type !== "select") delete next.options;
        if (patch.type === "select" && !next.options) next.options = ["Option 1"];
        const columnKey = patch.type === "tel" ? "phone" : patch.type === "email" ? "email" : null;
        const taken = columnKey !== null && config.fields.some((other, j) => j !== i && other.key === columnKey);
        if (columnKey !== null && !taken) next.key = columnKey;
        return next;
    });
    return { ...config, fields };
}

export function parseOptionLines(text: string): string[] {
    return text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}

export function setLeadFormSetting(
    config: LeadFormConfig,
    patch: { buttonLabel?: string; successMessage?: string; redirectUrl?: string; bookingUrl?: string; instagramHandle?: string }
): LeadFormConfig {
    const next: LeadFormConfig = { ...config, ...patch };
    if (patch.redirectUrl !== undefined && patch.redirectUrl.trim() === "") delete next.redirectUrl;
    // The booking link is saved trimmed; an empty one removes the thank-you button.
    if (patch.bookingUrl !== undefined) {
        const link = patch.bookingUrl.trim();
        if (link === "") delete next.bookingUrl;
        else next.bookingUrl = link;
    }
    // The handle is saved trimmed; an empty one removes the thank-you follow button.
    if (patch.instagramHandle !== undefined) {
        const handle = patch.instagramHandle.trim();
        if (handle === "") delete next.instagramHandle;
        else next.instagramHandle = handle;
    }
    return next;
}

const CONSENT_OPTIONAL_KEYS = ["privacyUrl", "deletionUrl", "deletionSteps", "contactEmail"] as const;

// Changes the consent box. A link or text left empty is removed. Turning the box off keeps its wording.
export function setLeadFormConsent(config: LeadFormConfig, patch: Partial<LeadFormConsent>): LeadFormConfig {
    const next: Record<string, unknown> = { ...(config.consent ?? { enabled: false, text: LEAD_FORM_CONSENT_DEFAULT_TEXT }), ...patch };
    for (const key of CONSENT_OPTIONAL_KEYS) {
        if (typeof next[key] !== "string") continue;
        const value = (next[key] as string).trim();
        if (value === "") delete next[key];
        else next[key] = value;
    }
    return { ...config, consent: next as LeadFormConsent };
}

// The form's HTML for the editor's Live Preview iframe.
export function previewLeadFormHtml(html: string): string {
    return replaceLeadFormMarkers(html, { slug: "preview" });
}
