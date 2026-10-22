import { describe, expect, it } from "vitest";
import { isPublicRoutePath } from "../publicRoutes";

describe("isPublicRoutePath", () => {
    it.each([
        "/webhooks",
        "/webhooks/mautic",
        "/api/webhooks/netjana-intel",
        "/auth/register",
        "/health",
        "/checkout/session",
        "/checkout/session/:id",
        "/billing/plans",
        "/extension/leads",
        "/landing-agent/public/pages/:slug",
        "/edge/nodes",
    ])("%s is public", (path) => {
        expect(isPublicRoutePath(path)).toBe(true);
    });

    it.each(["/webhooks-admin", "/authorize", "/healthz", "/checkout/sessions", "/billing/plans-admin", "/extensionx", "/edges", "/leads"])(
        "%s is not public, though it may share leading letters with a public path",
        (path) => {
            expect(isPublicRoutePath(path)).toBe(false);
        },
    );
});
