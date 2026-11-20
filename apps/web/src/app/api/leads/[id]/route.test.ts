import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        lead: { updateMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET, PATCH } from "./route";

function patchRequest(body: unknown) {
    return new Request("http://localhost/api/leads/lead-1", {
        method: "PATCH",
        body: JSON.stringify(body),
    }) as any;
}

function params(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/leads/[id] - campaignId reassignment is not allowed", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.lead.findUnique.mockResolvedValue({ id: "lead-1" });
    });

    it("strips a caller-supplied campaignId from the update payload", async () => {
        await PATCH(patchRequest({ status: "CONTACTED", campaignId: "campaign-victim" }), params("lead-1"));

        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
            data: { status: "CONTACTED" },
        });
    });

    it("passes through only the known-safe fields", async () => {
        await PATCH(patchRequest({ fullName: "New Name", email: "a@b.com" }), params("lead-1"));

        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
            data: { fullName: "New Name", email: "a@b.com" },
        });
    });
});

describe("GET /api/leads/[id] - consent per channel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("returns the latest consent state per channel and not the raw ledger rows", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({
            id: "lead-1",
            consentLedger: [
                { channel: "EMAIL", status: "GRANTED", purpose: "MARKETING_AND_SUPPORT", grantedAt: new Date(1) },
                { channel: "EMAIL", status: "REVOKED", purpose: "REVOCATION", grantedAt: new Date(2) },
            ],
        });

        const res = await GET(new Request("http://localhost/api/leads/lead-1") as any, params("lead-1"));
        const body = await res.json();

        expect(body.consentChannels).toEqual([
            { channel: "EMAIL", status: "REVOKED" },
            { channel: "WHATSAPP", status: "NONE" },
            { channel: "PHONE", status: "NONE" },
        ]);
        expect(body).not.toHaveProperty("consentLedger");
        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "lead-1", teamId: "team-1" },
            include: expect.objectContaining({ consentLedger: expect.anything() }),
        }));
    });
});
