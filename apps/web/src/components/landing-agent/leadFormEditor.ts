// Pure logic for the editor's lead form block and its settings panel. The panel and GrapesEditor
// only call these functions. The config lives in the marker's id (see leadFormConfig.ts).
import {
    decodeLeadFormMarkerId,
    encodeLeadFormMarkerId,
    LEAD_FORM_MARKER_CLASS,
    LEAD_FORM_MARKER_ID_PREFIX,
    LEAD_FORM_MAX_FIELDS,
    leadFormConfigSchema,
    type LeadFormConfig,
    type LeadFormField,
} from "@/modules/landing-agent/leadFormConfig";
import { replaceLeadFormMarkers } from "@/modules/landing-agent/leadFormHtml";

export const LEAD_FORM_DEFAULT_CONFIG: LeadFormConfig = {
    fields: [{ key: "email", label: "Work email", type: "email", required: true }],
    buttonLabel: "Send it to me",
    successMessage: "Thanks! Check your inbox.",
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
    if (result.success) return null;
    const issue = result.error.issues[0];
    return issue ? issue.message : "This form is not valid";
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

// Changing type keeps options only for select; a select gets one default option.
export function updateLeadFormField(config: LeadFormConfig, index: number, patch: Partial<LeadFormField>): LeadFormConfig {
    const fields = config.fields.map((field, i) => {
        if (i !== index) return field;
        const next: LeadFormField = { ...field, ...patch };
        if (patch.type !== undefined && patch.type !== "select") delete next.options;
        if (patch.type === "select" && !next.options) next.options = ["Option 1"];
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
    patch: { buttonLabel?: string; successMessage?: string; redirectUrl?: string }
): LeadFormConfig {
    const next: LeadFormConfig = { ...config, ...patch };
    if (patch.redirectUrl !== undefined && patch.redirectUrl.trim() === "") delete next.redirectUrl;
    return next;
}

// The form's HTML for the editor's Live Preview iframe.
export function previewLeadFormHtml(html: string): string {
    return replaceLeadFormMarkers(html, { slug: "preview" });
}
