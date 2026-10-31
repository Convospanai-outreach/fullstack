import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
    editorPathForCampaign,
    galleryTemplates,
    isCreateFromTemplateResponse,
    landingStartChoices,
    templatePreviewLayout,
    templateRequestBody,
    validateTemplateName,
} from "./landingTemplateGallery";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";

// The API keeps the source of truth in apps/api; this copy must be byte-for-byte the same data.
const API_FIXTURE = fileURLToPath(new URL("../../../tests/fixtures/landing-templates.json", import.meta.url));

describe("landing template gallery data", () => {
    it("the editor copy of the template data matches the fixture the API test checks against", () => {
        const copy = readFileSync(fileURLToPath(new URL("./landingTemplates.json", import.meta.url)), "utf8");
        expect(JSON.parse(copy)).toEqual(JSON.parse(readFileSync(API_FIXTURE, "utf8")));
    });

    it("shows every template as a card with its name, audience and description", () => {
        const cards = galleryTemplates();
        expect(cards).toHaveLength(11);
        for (const card of cards) {
            expect(card.name.trim().length).toBeGreaterThan(0);
            expect(card.audience.trim().length).toBeGreaterThan(0);
            expect(card.description.trim().length).toBeGreaterThan(0);
            expect(card.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
        }
    });

    it("draws a mini preview for every template from its markup: a hero, a form and the bullets", () => {
        for (const card of galleryTemplates()) {
            expect(["image-top", "image-side", "image-background", "text"]).toContain(card.preview.hero);
            expect(card.preview.hasForm).toBe(true);
            expect(card.preview.sections).toBeGreaterThan(1);
        }
    });
});

describe("templatePreviewLayout", () => {
    it("reads the hero layout from the classes the templates use", () => {
        expect(templatePreviewLayout('<section class="la-section la-hero la-hero-bg">').hero).toBe("image-background");
        expect(templatePreviewLayout('<section class="la-section la-hero la-hero-with-image">').hero).toBe("image-side");
        expect(templatePreviewLayout('<section class="la-section la-hero la-hero-top">').hero).toBe("image-top");
        expect(templatePreviewLayout('<section class="la-section la-hero">').hero).toBe("text");
    });

    it("counts sections and list items and spots the form marker", () => {
        const html = '<section class="la-section"><ul><li>a</li><li>b</li></ul></section><section><div class="cmf-form" id="cmf-form-x"></div></section>';
        expect(templatePreviewLayout(html)).toEqual({ hero: "text", sections: 2, bullets: 2, hasForm: true });
    });
});

describe("validateTemplateName", () => {
    it("trims the name and accepts 1 to 200 characters", () => {
        expect(validateTemplateName("  Spring guide  ")).toEqual({ ok: true, name: "Spring guide" });
        expect(validateTemplateName("x".repeat(200))).toEqual({ ok: true, name: "x".repeat(200) });
    });

    it.each([
        ["an empty name", ""],
        ["only spaces", "     "],
        ["more than 200 characters", "x".repeat(201)],
    ])("refuses %s with a message", (_label, value) => {
        const result = validateTemplateName(value);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
    });
});

describe("request and redirect helpers", () => {
    it("builds the request body from the template id and the trimmed name", () => {
        expect(templateRequestBody("free-guide", " Spring ")).toEqual({ templateId: "free-guide", name: "Spring" });
    });

    it("recognises a create response and rejects anything else", () => {
        expect(isCreateFromTemplateResponse({ campaignId: "lc-1", pageId: "lp-1" })).toBe(true);
        expect(isCreateFromTemplateResponse({ campaignId: "lc-1" })).toBe(false);
        expect(isCreateFromTemplateResponse(null)).toBe(false);
    });

    it("sends the editor to the new campaign", () => {
        expect(editorPathForCampaign("abc")).toBe("/landing-agent/abc/editor");
        expect(editorPathForCampaign("a/b")).toBe("/landing-agent/a%2Fb/editor");
    });
});

describe("landingStartChoices", () => {
    it("offers a template choice and an AI choice, in that order", () => {
        expect(landingStartChoices.map((c) => [c.id, c.title])).toEqual([
            ["template", "Start from a template"],
            ["ai", "Write it with AI"],
        ]);
    });
});

describe("landingAgentApi.createCampaignFromTemplate", () => {
    it("posts the template id and name to the from-template endpoint and returns the ids", async () => {
        const fetchMock = vi.fn(async () => new Response(JSON.stringify({ campaignId: "lc-1", pageId: "lp-1" }), { status: 201 }));
        vi.stubGlobal("fetch", fetchMock);
        try {
            const result = await landingAgentApi.createCampaignFromTemplate({ templateId: "free-guide", name: "Spring" });
            expect(result).toEqual({ campaignId: "lc-1", pageId: "lp-1" });
            const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
            expect(url).toMatch(/\/landing-agent\/campaigns\/from-template$/);
            expect(init.method).toBe("POST");
            expect(JSON.parse(String(init.body))).toEqual({ templateId: "free-guide", name: "Spring" });
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
