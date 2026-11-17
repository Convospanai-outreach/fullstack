import templateData from "./landingTemplates.json";

// Pure logic for the "Start from a template" gallery and the Start chooser. No DOM and no network:
// the components only call these functions. The template data is a copy of the API's source of
// truth (apps/api/src/modules/landing-agent/landingTemplates.json); a test keeps the two identical.

export type TemplatePreviewLayout = {
    hero: "image-top" | "image-side" | "image-background" | "text";
    sections: number;
    bullets: number;
    hasForm: boolean;
};

export type GalleryTemplate = {
    id: string;
    name: string;
    audience: string;
    description: string;
    accent: string;
    preview: TemplatePreviewLayout;
};

type TemplateRecord = {
    id: string;
    name: string;
    audience: string;
    description: string;
    accent: string;
    html: string;
};

const TEMPLATE_RECORDS = templateData as readonly TemplateRecord[];

const HERO_LAYOUTS: readonly [string, TemplatePreviewLayout["hero"]][] = [
    ["la-hero-bg", "image-background"],
    ["la-hero-with-image", "image-side"],
    ["la-hero-top", "image-top"],
];

// What the mini preview draws, read from the same classes the published page uses.
export function templatePreviewLayout(html: string): TemplatePreviewLayout {
    const hero = HERO_LAYOUTS.find(([cls]) => html.includes(cls))?.[1] ?? "text";
    return {
        hero,
        sections: (html.match(/<section\b/g) ?? []).length,
        bullets: (html.match(/<li\b/g) ?? []).length,
        // The stored data has the {{LEAD_FORM}} token; a saved page has the rendered marker.
        hasForm: html.includes('class="cmf-form"') || html.includes("{{LEAD_FORM}}"),
    };
}

export function galleryTemplates(): GalleryTemplate[] {
    return TEMPLATE_RECORDS.map(({ id, name, audience, description, accent, html }) => ({
        id,
        name,
        audience,
        description,
        accent,
        preview: templatePreviewLayout(html),
    }));
}

export type PageNameResult = { ok: true; name: string } | { ok: false; error: string };

export function validateTemplateName(value: string): PageNameResult {
    const name = value.trim();
    if (!name) return { ok: false, error: "Give the page a name." };
    if (name.length > 200) return { ok: false, error: "Keep the name to 200 characters or fewer." };
    return { ok: true, name };
}

// A blank page address is left out so the server generates one from the name.
export function templateRequestBody(templateId: string, name: string, path?: string): { templateId: string; name: string; path?: string } {
    const address = path?.trim();
    return address ? { templateId, name: name.trim(), path: address } : { templateId, name: name.trim() };
}

export function isCreateFromTemplateResponse(value: unknown): value is { campaignId: string; pageId: string } {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return typeof record["campaignId"] === "string" && typeof record["pageId"] === "string";
}

export function editorPathForCampaign(campaignId: string): string {
    return `/landing-agent/${encodeURIComponent(campaignId)}/editor`;
}

export const landingStartChoices = [
    {
        id: "template",
        title: "Start from a template",
        description: "Pick a layout, then edit the text, images and form in the editor. No AI, no credits.",
    },
    {
        id: "ai",
        title: "Write it with AI",
        description: "Describe your offer and let AI draft the copy and the layout.",
    },
] as const;
