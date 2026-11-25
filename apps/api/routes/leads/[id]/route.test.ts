import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockAuthorizeRole, mockRecordLeadDataSources, mockGetInstagramSourceForLead } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findFirst: vi.fn(), updateMany: vi.fn() },
        consentLedger: { findMany: vi.fn(), updateMany: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockRecordLeadDataSources: vi.fn().mockResolvedValue(undefined),
    mockGetInstagramSourceForLead: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    authorizeRole: mockAuthorizeRole,
    TeamRole: { MEMBER: "MEMBER" },
}));
vi.mock("@/lib/crm/leadDataSource", () => ({ recordLeadDataSources: mockRecordLeadDataSources }));
vi.mock("@/modules/creator-funnel/leadSource", () => ({ getInstagramSourceForLead: mockGetInstagramSourceForLead }));
const { recordCaptureConsent } = vi.hoisted(() => ({ recordCaptureConsent: vi.fn().mockResolvedValue(true) }));
vi.mock("@/modules/governance/captureConsent", () => ({ recordCaptureConsent }));

import { GET, PATCH } from "./route";

describe("GET /leads/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.consentLedger.findMany.mockResolvedValue([]);
    });

    it("returns the latest consent state per channel, read from the ledger", async () => {
        mockPrisma.lead.findFirst.mockResolvedValueOnce({ id: "lead-1" });
        mockGetInstagramSourceForLead.mockResolvedValueOnce(null);
        mockPrisma.consentLedger.findMany.mockResolvedValueOnce([
            { channel: "EMAIL", status: "GRANTED", purpose: "MARKETING_AND_SUPPORT", grantedAt: new Date(1) },
            { channel: "EMAIL", status: "REVOKED", purpose: "REVOCATION", grantedAt: new Date(2) },
        ]);

        const res = await GET(new Request("http://localhost/leads/lead-1"), { params: Promise.resolve({ id: "lead-1" }) });
        const body = await res.json();

        expect(mockPrisma.consentLedger.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { leadId: "lead-1" } }));
        expect(body.consentChannels).toEqual([
            { channel: "EMAIL", status: "REVOKED" },
            { channel: "WHATSAPP", status: "NONE" },
            { channel: "PHONE", status: "NONE" },
        ]);
    });

    it("returns the lead with the Instagram keyword source it came from", async () => {
        mockPrisma.lead.findFirst.mockResolvedValueOnce({ id: "lead-1", fullName: "Asha" });
        const source = { triggerId: "trigger-1", keyword: "GUIDE", contentPostId: "post-1", postTitle: "Free guide", platform: "INSTAGRAM" };
        mockGetInstagramSourceForLead.mockResolvedValueOnce(source);

        const res = await GET(new Request("http://localhost/leads/lead-1"), { params: Promise.resolve({ id: "lead-1" }) });
        const body = await res.json();

        expect(mockGetInstagramSourceForLead).toHaveBeenCalledWith("team-1", "lead-1");
        expect(body).toMatchObject({ id: "lead-1", fullName: "Asha", instagramSource: source });
    });

    it("returns instagramSource null for a lead no keyword reply created", async () => {
        mockPrisma.lead.findFirst.mockResolvedValueOnce({ id: "lead-1" });
        mockGetInstagramSourceForLead.mockResolvedValueOnce(null);

        const res = await GET(new Request("http://localhost/leads/lead-1"), { params: Promise.resolve({ id: "lead-1" }) });

        expect(await res.json()).toMatchObject({ id: "lead-1", instagramSource: null });
    });

    it("404s another team's lead without looking up its source", async () => {
        mockPrisma.lead.findFirst.mockResolvedValueOnce(null);

        const res = await GET(new Request("http://localhost/leads/lead-9"), { params: Promise.resolve({ id: "lead-9" }) });

        expect(res.status).toBe(404);
        expect(mockGetInstagramSourceForLead).not.toHaveBeenCalled();
    });
});

function patchRequest(body: any) {
    return new Request("http://localhost/leads/lead-1", { method: "PATCH", body: JSON.stringify(body) });
}

describe("PATCH /leads/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("records a MANUAL provenance row for each field that actually changed", async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce({ id: "lead-1", company: "Old Co", domain: null })
            .mockResolvedValueOnce({ id: "lead-1", company: "New Co", domain: "new.example" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });

        await PATCH(patchRequest({ company: "New Co", domain: " HTTPS://WWW.New.Example.:443/about " }), { params: Promise.resolve({ id: "lead-1" }) });
        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ domain: "new.example" }),
        }));

        expect(mockRecordLeadDataSources).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ leadId: "lead-1", field: "company", source: "MANUAL", value: "New Co" }),
                expect.objectContaining({ leadId: "lead-1", field: "domain", source: "MANUAL", value: "new.example" }),
            ])
        );
    });

    it("does not record provenance for a field that was submitted but didn't actually change", async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce({ id: "lead-1", company: "Same Co" })
            .mockResolvedValueOnce({ id: "lead-1", company: "Same Co" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });

        await PATCH(patchRequest({ company: "Same Co" }), { params: Promise.resolve({ id: "lead-1" }) });

        expect(mockRecordLeadDataSources).not.toHaveBeenCalled();
    });

    it("silently drops fields outside the allowlist without recording provenance for them", async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce({ id: "lead-1", company: "Old Co" })
            .mockResolvedValueOnce({ id: "lead-1", company: "New Co" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });

        await PATCH(patchRequest({ company: "New Co", intentScore: 0.99 }), { params: Promise.resolve({ id: "lead-1" }) });

        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
            data: { company: "New Co" },
        });
    });

    // roadmap 3.3 (S-10): allowlisted keys carried untyped values straight to
    // Prisma (e.g. tags as a string, consentObtained as "yes").
    it("400s wrongly typed allowlisted fields without writing", async () => {
        mockPrisma.lead.findFirst.mockResolvedValueOnce({ id: "lead-1" });

        const response = await PATCH(
            patchRequest({ tags: "vip", consentObtained: "yes" }),
            { params: Promise.resolve({ id: "lead-1" }) }
        );

        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json.details.fieldErrors.tags).toBeDefined();
        expect(json.details.fieldErrors.consentObtained).toBeDefined();
        expect(mockPrisma.lead.updateMany).not.toHaveBeenCalled();
    });

    // whatsappConsentAt is a DateTime column: any other string reached Prisma and
    // came back as a 500.
    it("400s a whatsappConsentAt that is not an ISO datetime without writing", async () => {
        mockPrisma.lead.findFirst.mockResolvedValueOnce({ id: "lead-1" });

        const response = await PATCH(
            patchRequest({ whatsappConsentAt: "yes" }),
            { params: Promise.resolve({ id: "lead-1" }) }
        );

        expect(response.status).toBe(400);
        expect((await response.json()).details.fieldErrors.whatsappConsentAt).toBeDefined();
        expect(mockPrisma.lead.updateMany).not.toHaveBeenCalled();
    });

    it("writes an ISO datetime whatsappConsentAt", async () => {
        mockPrisma.lead.findFirst
            .mockResolvedValueOnce({ id: "lead-1", whatsappConsentAt: null })
            .mockResolvedValueOnce({ id: "lead-1" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });

        const response = await PATCH(
            patchRequest({ whatsappConsentAt: "2026-01-01T10:00:00.000Z" }),
            { params: Promise.resolve({ id: "lead-1" }) }
        );

        expect(response.status).toBe(200);
        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
            data: { whatsappConsentAt: "2026-01-01T10:00:00.000Z" },
        });
    });
});

describe("PATCH /leads/[id] - the consent toggle and the ledger", () => {
    const call = (body: any) => PATCH(patchRequest(body), { params: Promise.resolve({ id: "lead-1" }) });
    const lead = (consentObtained: boolean) => ({ id: "lead-1", consentObtained });

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.consentLedger.findMany.mockResolvedValue([]);
        mockPrisma.consentLedger.updateMany.mockResolvedValue({ count: 1 });
        recordCaptureConsent.mockResolvedValue(true);
    });

    it("turning consent on writes a ledger row for the user who clicked", async () => {
        mockPrisma.lead.findFirst.mockResolvedValueOnce(lead(false)).mockResolvedValueOnce(lead(true));

        await call({ consentObtained: true });

        expect(recordCaptureConsent).toHaveBeenCalledWith(expect.objectContaining({
            leadId: "lead-1", userId: "user-1", channel: "EMAIL", proof: "Toggled on by a team member",
        }));
        expect(mockPrisma.consentLedger.updateMany).not.toHaveBeenCalled();
    });

    it("turning consent off withdraws every granted ledger row for the lead", async () => {
        mockPrisma.lead.findFirst.mockResolvedValueOnce(lead(true)).mockResolvedValueOnce(lead(false));

        await call({ consentObtained: false });

        expect(mockPrisma.consentLedger.updateMany).toHaveBeenCalledWith({
            where: { leadId: "lead-1", status: "GRANTED" },
            data: { status: "REVOKED", revokedAt: expect.any(Date) },
        });
        expect(recordCaptureConsent).not.toHaveBeenCalled();
    });

    it("does nothing to the ledger when the flag is not changing or not sent", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(lead(true));

        await call({ consentObtained: true });
        await call({ company: "Acme" });

        expect(recordCaptureConsent).not.toHaveBeenCalled();
        expect(mockPrisma.consentLedger.updateMany).not.toHaveBeenCalled();
    });

    it("returns the per-channel consent state so the lead page keeps its chips after a toggle", async () => {
        mockPrisma.lead.findFirst.mockResolvedValueOnce(lead(true)).mockResolvedValueOnce(lead(false));
        mockPrisma.consentLedger.findMany.mockResolvedValueOnce([
            { channel: "EMAIL", status: "REVOKED", purpose: "MARKETING_AND_SUPPORT", grantedAt: new Date(1) },
        ]);

        const body = await (await call({ consentObtained: false })).json();

        expect(body.consentChannels[0]).toEqual({ channel: "EMAIL", status: "REVOKED" });
    });
});
