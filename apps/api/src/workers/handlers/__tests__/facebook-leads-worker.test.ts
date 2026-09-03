import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockDecryptCredential } = vi.hoisted(() => ({
    mockPrisma: {
        facebookLeadSource: { findMany: vi.fn(), update: vi.fn() },
        facebookLeadSyncCursor: { upsert: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
        lead: { findFirst: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn() },
        leadActivity: { create: vi.fn() },
    },
    mockDecryptCredential: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: mockDecryptCredential }));

import { syncDueFacebookLeadSources } from "../facebook-leads-worker";

function jsonResponse(body: unknown, ok = true) {
    return { ok, json: async () => body } as Response;
}

describe("syncDueFacebookLeadSources", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.facebookLeadSyncCursor.create = vi.fn();
        mockPrisma.leadActivity.create.mockResolvedValue({});
        mockDecryptCredential.mockResolvedValue("page-access-token");
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("creates a new Lead from a Facebook lead's field_data, tagged with the FACEBOOK_LEADS source", async () => {
        mockPrisma.facebookLeadSource.findMany.mockResolvedValue([
            { id: "source-1", teamId: "team-1", pageId: "page-1", encryptedPageAccessToken: {}, lastError: null },
        ]);
        mockPrisma.facebookLeadSyncCursor.upsert.mockResolvedValue({ id: "cursor-1", lastCreatedTime: null });
        mockPrisma.facebookLeadSyncCursor.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: "form-1", name: "Contact Us" }] })) // leadgen_forms
            .mockResolvedValueOnce(
                jsonResponse({
                    data: [
                        {
                            id: "fb-lead-1",
                            created_time: "2026-09-01T00:00:00+0000",
                            field_data: [
                                { name: "email", values: ["lead@example.com"] },
                                { name: "full_name", values: ["Ada Lovelace"] },
                            ],
                        },
                    ],
                })
            ); // leads
        global.fetch = fetchMock as any;

        const results = await syncDueFacebookLeadSources();

        expect(mockPrisma.lead.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ teamId: "team-1", email: "lead@example.com", source: "FACEBOOK_LEADS", status: "NEW" }),
        });
        expect(mockPrisma.leadActivity.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ leadId: "lead-1", channel: "FACEBOOK_LEADS" }) })
        );
        expect(mockPrisma.facebookLeadSyncCursor.update).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "cursor-1" }, data: expect.objectContaining({ status: "IDLE" }) })
        );
        expect(results).toHaveLength(1);
    });

    it("follows Graph API pagination (paging.next) instead of only reading the first page of leads", async () => {
        mockPrisma.facebookLeadSource.findMany.mockResolvedValue([
            { id: "source-1", teamId: "team-1", pageId: "page-1", encryptedPageAccessToken: {}, lastError: null },
        ]);
        mockPrisma.facebookLeadSyncCursor.upsert.mockResolvedValue({ id: "cursor-1", lastCreatedTime: null });
        mockPrisma.facebookLeadSyncCursor.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });

        const nextPageUrl = "https://graph.facebook.com/v21.0/form-1/leads?after=cursor123&access_token=page-access-token";
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: "form-1" }] })) // leadgen_forms
            .mockResolvedValueOnce(
                jsonResponse({
                    data: [{ id: "fb-lead-1", created_time: "2026-09-01T00:00:00+0000", field_data: [{ name: "email", values: ["a@example.com"] }] }],
                    paging: { next: nextPageUrl },
                })
            ) // leads page 1
            .mockResolvedValueOnce(
                jsonResponse({
                    data: [{ id: "fb-lead-2", created_time: "2026-09-01T01:00:00+0000", field_data: [{ name: "email", values: ["b@example.com"] }] }],
                })
            ); // leads page 2 (no further paging.next)
        global.fetch = fetchMock as any;

        const results = await syncDueFacebookLeadSources();

        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(fetchMock).toHaveBeenNthCalledWith(3, nextPageUrl);
        expect(mockPrisma.lead.create).toHaveBeenCalledTimes(2);
        expect(results[0]).toMatchObject({ synced: 2 });
    });

    it("follows Graph API pagination for the leadgen_forms list too, not just leads", async () => {
        mockPrisma.facebookLeadSource.findMany.mockResolvedValue([
            { id: "source-1", teamId: "team-1", pageId: "page-1", encryptedPageAccessToken: {}, lastError: null },
        ]);
        mockPrisma.facebookLeadSyncCursor.upsert
            .mockResolvedValueOnce({ id: "cursor-1", lastCreatedTime: null })
            .mockResolvedValueOnce({ id: "cursor-2", lastCreatedTime: null });
        mockPrisma.facebookLeadSyncCursor.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });

        const nextFormsPageUrl = "https://graph.facebook.com/v21.0/page-1/leadgen_forms?after=cursor456&access_token=page-access-token";
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: "form-1" }], paging: { next: nextFormsPageUrl } })) // leadgen_forms page 1
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: "form-2" }] })) // leadgen_forms page 2
            .mockResolvedValueOnce(jsonResponse({ data: [] })) // form-1's leads
            .mockResolvedValueOnce(jsonResponse({ data: [] })); // form-2's leads
        global.fetch = fetchMock as any;

        const results = await syncDueFacebookLeadSources();

        expect(fetchMock).toHaveBeenNthCalledWith(2, nextFormsPageUrl);
        expect(results.map((r: any) => r.formId)).toEqual(["form-1", "form-2"]);
    });

    it("continues processing remaining leads (without duplicating already-recorded activity on the next poll) after one lead throws mid-batch", async () => {
        mockPrisma.facebookLeadSource.findMany.mockResolvedValue([
            { id: "source-1", teamId: "team-1", pageId: "page-1", encryptedPageAccessToken: {}, lastError: null },
        ]);
        mockPrisma.facebookLeadSyncCursor.upsert.mockResolvedValue({ id: "cursor-1", lastCreatedTime: null });
        mockPrisma.facebookLeadSyncCursor.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create
            .mockResolvedValueOnce({ id: "lead-1" })
            .mockRejectedValueOnce(new Error("db unavailable"))
            .mockResolvedValueOnce({ id: "lead-3" });

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: "form-1" }] })) // leadgen_forms
            .mockResolvedValueOnce(
                jsonResponse({
                    data: [
                        { id: "fb-lead-1", created_time: "2026-09-01T00:00:00+0000", field_data: [{ name: "email", values: ["a@example.com"] }] },
                        { id: "fb-lead-2", created_time: "2026-09-01T01:00:00+0000", field_data: [{ name: "email", values: ["b@example.com"] }] },
                        { id: "fb-lead-3", created_time: "2026-09-01T02:00:00+0000", field_data: [{ name: "email", values: ["c@example.com"] }] },
                    ],
                })
            );
        global.fetch = fetchMock as any;

        const results = await syncDueFacebookLeadSources();

        expect(mockPrisma.lead.create).toHaveBeenCalledTimes(3);
        expect(mockPrisma.leadActivity.create).toHaveBeenCalledTimes(2);
        expect(mockPrisma.facebookLeadSyncCursor.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: "IDLE", lastCreatedTime: new Date("2026-09-01T02:00:00+0000") }) })
        );
        expect(results[0]).toMatchObject({ synced: 3 });
    });

    it("throws instead of silently truncating when Graph API pagination exceeds the safety cap", async () => {
        mockPrisma.facebookLeadSource.findMany.mockResolvedValue([
            { id: "source-1", teamId: "team-1", pageId: "page-1", encryptedPageAccessToken: {}, lastError: null },
        ]);
        mockPrisma.facebookLeadSyncCursor.upsert.mockResolvedValue({ id: "cursor-1", lastCreatedTime: null });
        mockPrisma.facebookLeadSyncCursor.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.facebookLeadSyncCursor.update.mockResolvedValue({});

        const loopingUrl = "https://graph.facebook.com/v21.0/form-1/leads?after=forever";
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: "form-1" }] })) // leadgen_forms
            .mockResolvedValue(
                jsonResponse({
                    data: [{ id: "fb-lead", created_time: "2026-09-01T00:00:00+0000", field_data: [] }],
                    paging: { next: loopingUrl },
                })
            ); // leads: always another page - never terminates on its own
        global.fetch = fetchMock as any;

        const results = await syncDueFacebookLeadSources();

        expect(results[0]).toMatchObject({ formId: "form-1", synced: 0 });
        expect(results[0].error).toMatch(/pagination exceeded/i);
        expect(mockPrisma.facebookLeadSyncCursor.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ status: "ERROR" }) })
        );
    });

    it("updates an existing Lead (matched by email) instead of creating a duplicate", async () => {
        mockPrisma.facebookLeadSource.findMany.mockResolvedValue([
            { id: "source-1", teamId: "team-1", pageId: "page-1", encryptedPageAccessToken: {}, lastError: null },
        ]);
        mockPrisma.facebookLeadSyncCursor.upsert.mockResolvedValue({ id: "cursor-1", lastCreatedTime: null });
        mockPrisma.facebookLeadSyncCursor.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "existing-lead", fullName: null, company: null, jobTitle: null, phone: null, source: "FACEBOOK_LEADS" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.lead.findUniqueOrThrow.mockResolvedValue({ id: "existing-lead" });

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: "form-1" }] }))
            .mockResolvedValueOnce(
                jsonResponse({
                    data: [{ id: "fb-lead-2", created_time: "2026-09-01T00:00:00+0000", field_data: [{ name: "email", values: ["lead@example.com"] }] }],
                })
            );
        global.fetch = fetchMock as any;

        await syncDueFacebookLeadSources();

        expect(mockPrisma.lead.create).not.toHaveBeenCalled();
        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "existing-lead", teamId: "team-1" } })
        );
    });

    it("does not silently succeed if the lead was reassigned out of the team between the lookup and the write", async () => {
        mockPrisma.facebookLeadSource.findMany.mockResolvedValue([
            { id: "source-1", teamId: "team-1", pageId: "page-1", encryptedPageAccessToken: {}, lastError: null },
        ]);
        mockPrisma.facebookLeadSyncCursor.upsert.mockResolvedValue({ id: "cursor-1", lastCreatedTime: null });
        mockPrisma.facebookLeadSyncCursor.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "existing-lead", fullName: null, company: null, jobTitle: null, phone: null, source: "FACEBOOK_LEADS" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 0 });

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ data: [{ id: "form-1" }] }))
            .mockResolvedValueOnce(
                jsonResponse({
                    data: [{ id: "fb-lead-2", created_time: "2026-09-01T00:00:00+0000", field_data: [{ name: "email", values: ["lead@example.com"] }] }],
                })
            );
        global.fetch = fetchMock as any;

        await syncDueFacebookLeadSources();

        expect(mockPrisma.lead.findUniqueOrThrow).not.toHaveBeenCalled();
        expect(mockPrisma.leadActivity.create).not.toHaveBeenCalled();
    });

    it("skips a form whose sync cursor is already locked by another run", async () => {
        mockPrisma.facebookLeadSource.findMany.mockResolvedValue([
            { id: "source-1", teamId: "team-1", pageId: "page-1", encryptedPageAccessToken: {}, lastError: null },
        ]);
        mockPrisma.facebookLeadSyncCursor.upsert.mockResolvedValue({ id: "cursor-1", lastCreatedTime: null });
        mockPrisma.facebookLeadSyncCursor.updateMany.mockResolvedValue({ count: 0 }); // lost the claim

        const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: [{ id: "form-1" }] }));
        global.fetch = fetchMock as any;

        const results = await syncDueFacebookLeadSources();

        expect(results[0]).toMatchObject({ skipped: "locked" });
        // Only the leadgen_forms call happened - never fetched /leads for a locked form.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
