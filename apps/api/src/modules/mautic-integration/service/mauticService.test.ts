import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findFirst: vi.fn(), updateMany: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { mauticService } from "./mauticService";

function jsonResponse(body: unknown, ok = true, status = 200) {
    return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe("mauticService.pushLead", () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["MAUTIC_BASE_URL"] = "https://mautic.example.com";
        process.env["MAUTIC_USERNAME"] = "admin";
        process.env["MAUTIC_PASSWORD"] = "secret";
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        global.fetch = originalFetch;
    });

    it("is a no-op when Mautic isn't configured", async () => {
        delete process.env["MAUTIC_BASE_URL"];

        const result = await mauticService.pushLead("lead-1", "team-1");

        expect(result.status).toBe("skipped");
        expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
    });

    it("refuses to push a lead that doesn't belong to the given team", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);

        const result = await mauticService.pushLead("lead-from-team-b", "team-a");

        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead-from-team-b", teamId: "team-a" } });
        expect(result).toEqual({ status: "error", details: "Lead not found" });
    });

    it("creates a new Mautic contact when none exists for the lead's email, tagged with the team slug", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", email: "a@b.com", fullName: "Ada Lovelace", company: "Acme" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ contacts: {} })) // search: none found
            .mockResolvedValueOnce(jsonResponse({ contact: { id: 42 } })); // create
        global.fetch = fetchMock as any;

        const result = await mauticService.pushLead("lead-1", "team-1");

        expect(result).toEqual({ status: "created", mauticContactId: "42" });
        const createCall = fetchMock.mock.calls[1];
        expect(createCall[0]).toBe("https://mautic.example.com/api/contacts/new");
        const createBody = JSON.parse(createCall[1].body);
        expect(createBody.tags).toEqual(["team-team-1"]);
        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
            data: { mauticContactId: "42", mauticSyncedAt: expect.any(Date) },
        });
    });

    it("updates the existing Mautic contact instead of duplicating on a resubmitted email", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", email: "a@b.com", fullName: null, company: null });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ contacts: { "99": { id: 99 } } })) // search: found existing
            .mockResolvedValueOnce(jsonResponse({ contact: { id: 99 } })); // edit
        global.fetch = fetchMock as any;

        const result = await mauticService.pushLead("lead-1", "team-1");

        expect(result).toEqual({ status: "updated", mauticContactId: "99" });
        const editCall = fetchMock.mock.calls[1];
        expect(editCall[0]).toBe("https://mautic.example.com/api/contacts/99/edit");
        expect(editCall[1].method).toBe("PATCH");
    });

    it("scopes the final sync-status write by teamId too, not just the pre-check (defense in depth)", async () => {
        // Simulates the lead moving out of this team between the pre-check and the write
        // (e.g. reassigned/deleted) - the write must not silently succeed unscoped.
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", email: "a@b.com", fullName: null, company: null });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ contacts: {} }))
            .mockResolvedValueOnce(jsonResponse({ contact: { id: 42 } }));
        global.fetch = fetchMock as any;

        const result = await mauticService.pushLead("lead-1", "team-1");

        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
            data: expect.objectContaining({ mauticContactId: "42" }),
        });
        expect(result).toEqual({ status: "error", details: "Lead not found" });
    });
});
