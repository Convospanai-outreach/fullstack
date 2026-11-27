import { describe, expect, it, vi } from "vitest";
import { APP_URL } from "../../../config/appUrl.mjs";
import { resolveHelpActionHref } from "./content";

vi.mock("../../../config/appUrl.mjs", () => ({ APP_URL: "https://app.example.test" }));

describe("resolveHelpActionHref", () => {
    it.each(["/settings", "/settings/mailboxes", "/leads/import"])("prefixes %s with the app origin", (href) => {
        expect(resolveHelpActionHref(href)).toBe(APP_URL + href);
    });

    it.each(["/pricing", "mailto:help@example.test", "https://example.test/settings"])("keeps %s unchanged", (href) => {
        expect(resolveHelpActionHref(href)).toBe(href);
    });
});
