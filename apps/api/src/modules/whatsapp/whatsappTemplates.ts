import { prisma } from "@/lib/db";
import { GRAPH_VERSION, getTeamWabaConfig } from "./wabaCredentials";

// WhatsApp template messages in sequences (creator funnel phase 5c-2). A business may only start a
// conversation (or write after the 24h customer-service window) with a template Meta has approved.
// Checked 2026-10-03:
// - https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
//   (send = POST /{phone-number-id}/messages with type "template"; only APPROVED templates can be sent)
// - https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates/
//   (GET /{waba-id}/message_templates: name, language, status, components; whatsapp_business_management)
// - https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/ (132018 = invalid parameters)
// Only templates whose variables are all numbered body variables ({{1}}, {{2}}...) are used: no header
// variables or media and no dynamic buttons, so a send is plain body text values.

export const TEMPLATE_NAME_PATTERN = /^[a-z0-9_]{1,512}$/;
// Meta's limit for a body text parameter when other components are present is 1024 characters.
const MAX_VALUE_LENGTH = 1024;

type Component = { type?: string; format?: string; text?: string; buttons?: { url?: string; type?: string }[] };
type Template = { name?: string; language?: string; status?: string; components?: Component[] };

export type TemplateCheck = { ok: true; variables: number } | { ok: false; code: string; reason: string };

/** How many numbered body variables a template has, or why the sequence engine can't send it. */
export function templateShape(template: Template): TemplateCheck {
    const components = template.components ?? [];
    for (const c of components) {
        const type = (c.type ?? "").toUpperCase();
        if (type === "HEADER" && ((c.format && c.format.toUpperCase() !== "TEXT") || c.text?.includes("{{"))) {
            return { ok: false, code: "WHATSAPP_TEMPLATE_UNSUPPORTED", reason: "The template's header has media or variables; only body variables are supported." };
        }
        if (type === "BUTTONS" && c.buttons?.some((b) => b.url?.includes("{{"))) {
            return { ok: false, code: "WHATSAPP_TEMPLATE_UNSUPPORTED", reason: "The template has a button with a variable; only body variables are supported." };
        }
    }
    const body = components.find((c) => (c.type ?? "").toUpperCase() === "BODY")?.text ?? "";
    const names = [...body.matchAll(/\{\{\s*([^}\s]+)\s*\}\}/g)].map((m) => m[1]!);
    if (names.some((n) => !/^\d+$/.test(n))) {
        return { ok: false, code: "WHATSAPP_TEMPLATE_UNSUPPORTED", reason: "The template uses named variables; use numbered ones ({{1}}, {{2}})." };
    }
    return { ok: true, variables: new Set(names).size };
}

/** Looks the template up on the team's WhatsApp Business Account and checks it's approved and sendable. */
export async function checkTemplate(teamId: string, name: string, language: string): Promise<TemplateCheck> {
    const [config, team] = await Promise.all([
        getTeamWabaConfig(teamId),
        prisma.team.findUnique({ where: { id: teamId }, select: { whatsappBusinessAccountId: true } }),
    ]);
    if (!config) return { ok: false, code: "WHATSAPP_NOT_CONNECTED", reason: "WhatsApp Business isn't connected." };
    if (!team?.whatsappBusinessAccountId) {
        return { ok: false, code: "WHATSAPP_NO_WABA_ID", reason: "Add the WhatsApp Business Account ID in WhatsApp settings." };
    }
    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(team.whatsappBusinessAccountId)}/message_templates`);
    url.searchParams.set("name", name);
    url.searchParams.set("fields", "name,language,status,components");
    url.searchParams.set("limit", "100");
    let templates: Template[];
    try {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${config.accessToken}` }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) return { ok: false, code: "WHATSAPP_TEMPLATE_LOOKUP_FAILED", reason: `WhatsApp didn't return the templates (status ${res.status}).` };
        templates = ((await res.json()) as { data?: Template[] }).data ?? [];
    } catch {
        return { ok: false, code: "WHATSAPP_TEMPLATE_LOOKUP_FAILED", reason: "Couldn't reach WhatsApp to check the template." };
    }
    // The name filter isn't documented as exact, so match name and language here.
    const template = templates.find((t) => t.name === name && t.language === language);
    if (!template) return { ok: false, code: "WHATSAPP_TEMPLATE_NOT_FOUND", reason: `No template "${name}" in ${language} on this WhatsApp Business Account.` };
    if (template.status !== "APPROVED") {
        return { ok: false, code: "WHATSAPP_TEMPLATE_NOT_APPROVED", reason: `The template "${name}" isn't approved (status ${template.status ?? "unknown"}).` };
    }
    return templateShape(template);
}

/** The step's values (one per line), with {first_name} filled in, cleaned to plain one-line text. */
export function templateValues(body: string | null | undefined, lead: { fullName?: string | null }) {
    // Social leads are named after their @handle until they say their name.
    const first = lead.fullName?.trim().split(/\s+/)[0]?.replace(/^@.*/, "") || "there";
    return (body ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => [...line.replace(/\{first_name\}/gi, first).replace(/[\t\r\n]+/g, " ").replace(/ {2,}/g, " ").trim()].slice(0, MAX_VALUE_LENGTH).join(""));
}

/**
 * The recipient number for the Cloud API: digits with the country code. Only numbers stored in
 * international form are used (a leading + or 00, or 11+ digits); a national number like
 * "98765 43210" can't be dialled safely without guessing the country, so it's skipped.
 */
export function whatsappRecipient(phone: string | null | undefined) {
    const raw = phone?.trim() ?? "";
    let digits = raw.replace(/\D/g, "");
    if (raw.startsWith("00")) digits = digits.slice(2);
    const international = raw.startsWith("+") || raw.startsWith("00") || digits.length >= 11;
    return international && digits.length >= 8 && digits.length <= 15 ? digits : null;
}
