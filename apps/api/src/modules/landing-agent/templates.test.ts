import { describe, expect, it } from "vitest";
import { LANDING_PAGE_TEMPLATES } from "./templates";
import { renderSectionsToHtml } from "./rendering";

describe("LANDING_PAGE_TEMPLATES", () => {
    it("has unique titles, each badged as a template", () => {
        const titles = LANDING_PAGE_TEMPLATES.map((t) => t.title);
        expect(new Set(titles).size).toBe(titles.length);
        for (const template of LANDING_PAGE_TEMPLATES) {
            expect(template.description.startsWith("Template:")).toBe(true);
        }
    });

    it.each(LANDING_PAGE_TEMPLATES.map((t) => [t.title, t] as const))("%s starts with a hero, has a call to action and unique section ids", (_title, template) => {
        const ids = template.sections.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(template.sections[0]?.type).toBe("hero");
        expect(template.sections.some((s) => s.ctaLabel)).toBe(true);
        for (const section of template.sections) {
            expect(section.heading).toBeTruthy();
        }
    });

    it.each(LANDING_PAGE_TEMPLATES.map((t) => [t.title, t] as const))("%s renders every section", (_title, template) => {
        const html = renderSectionsToHtml(template.sections);
        expect(html).not.toContain("undefined");
        for (const section of template.sections) {
            expect(html).toContain(`id="${section.id}"`);
        }
    });
});
