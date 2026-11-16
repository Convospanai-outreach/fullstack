import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        customDomain: { findMany: vi.fn() },
        domainAuthenticationCheck: { findMany: vi.fn() },
        connectedMailbox: { findMany: vi.fn() },
        playbookRun: { findMany: vi.fn() },
        lead: { findFirst: vi.fn() },
    },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { loadHoldbackContext } from "./draftHoldbackContext";

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("WEB_BASE_URL", "https://www.app.craftmyfunnel.live/");
    prismaMock.customDomain.findMany.mockResolvedValue([{ domain: "Go.Acme.com" }]);
    prismaMock.domainAuthenticationCheck.findMany.mockResolvedValue([{ domain: "acme.io" }]);
    prismaMock.connectedMailbox.findMany.mockResolvedValue([{ email: "me@acme.co" }]);
    prismaMock.playbookRun.findMany.mockResolvedValue([{ bookingUrl: "https://cal.com/ann/30min" }]);
    prismaMock.lead.findFirst.mockResolvedValue({ email: "lead@x.org", phone: "+1 415 555 0100" });
});

describe("loadHoldbackContext", () => {
    it("collects the team's own hosts, normalised and without duplicates", async () => {
        const c = await loadHoldbackContext("team-1", "lead-1");
        expect(c.ownedHosts.sort()).toEqual(["acme.co", "acme.io", "app.craftmyfunnel.live", "cal.com", "go.acme.com"]);
    });

    it("lists the sender's mailboxes and the lead's own details as known contacts, scoped to the team", async () => {
        const c = await loadHoldbackContext("team-1", "lead-1");
        expect(c.knownContacts).toEqual({ emails: ["me@acme.co", "lead@x.org"], phones: ["+1 415 555 0100"] });
        expect(prismaMock.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead-1", teamId: "team-1" }, select: { email: true, phone: true } });
        expect(prismaMock.customDomain.findMany).toHaveBeenCalledWith({ where: { teamId: "team-1" }, select: { domain: true } });
    });
});
