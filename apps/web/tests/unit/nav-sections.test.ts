import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_FLAGS, type HiddenFeatureKey } from "@/lib/productFlags";
import { NAV_SECTIONS, SETTINGS_GROUPS, sectionForPath, visibleTabs } from "@/lib/navSections";

const APP = path.resolve(__dirname, "../../src/app");
const pageExists = (href: string) =>
    existsSync(path.join(APP, "(dashboard)", href, "page.tsx")) || existsSync(path.join(APP, href, "page.tsx"));

const settingsHrefs = SETTINGS_GROUPS.flatMap((group) => group.links.map((link) => link.href));
const tabHrefs = NAV_SECTIONS.flatMap((section) => section.tabs.map((tab) => tab.href));

describe("navigation sections", () => {
    it("keeps the member sidebar at 8 entries or fewer (sections + Settings)", () => {
        expect(NAV_SECTIONS.length + 1).toBeLessThanOrEqual(8);
    });

    it("points every tab and settings link at a page that exists", () => {
        for (const href of [...tabHrefs, ...settingsHrefs]) expect(pageExists(href), href).toBe(true);
    });

    it("keeps every former sidebar destination one tab or settings link away", () => {
        // The previous sidebar's entries (Admin and Monitoring moved to the admin console / ⌘K,
        // Approvals to an Inbox tab, Tools to Labs in the Help menu).
        const former = [
            "/inbox", "/dashboard", "/leads", "/accounts", "/icp-builder", "/templates", "/landing-agent/new",
            "/campaigns", "/automations", "/pipeline", "/calendar", "/intel", "/analytics/roi", "/governance",
            "/settings/audit", "/settings/team", "/billing",
            // CRM was already hidden from the sidebar during the email-first beta.
            ...(PRODUCT_FLAGS.emailFirstBeta ? [] : ["/settings/crm"]),
        ];
        const reachable = new Set([...tabHrefs, ...settingsHrefs]);
        for (const href of former) expect(reachable.has(href), href).toBe(true);
    });

    it("finds the section for nested pages", () => {
        expect(sectionForPath("/leads/import")?.key).toBe("leads");
        expect(sectionForPath("/analytics/journey")?.key).toBe("reports");
        expect(sectionForPath("/landing-agent/abc123")?.key).toBe("content");
        expect(sectionForPath("/calendar")?.key).toBe("pipeline");
        expect(sectionForPath("/settings/team")).toBeUndefined();
        expect(sectionForPath("/leadsx")).toBeUndefined();
    });

    it("shows flagged tabs only once the feature is live", () => {
        const campaigns = NAV_SECTIONS.find((section) => section.key === "campaigns")!;
        const none = visibleTabs(campaigns, new Set<HiddenFeatureKey>()).map((tab) => tab.href);
        expect(none).toEqual(["/campaigns", "/automations"]);

        const withWhatsApp = visibleTabs(campaigns, new Set<HiddenFeatureKey>(["whatsapp"])).map((tab) => tab.href);
        expect(withWhatsApp).toEqual(["/campaigns", "/automations", "/whatsapp"]);
    });
});
