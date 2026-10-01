import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockEnqueue, mockAdvanceLead } = vi.hoisted(() => ({
    mockPrisma: {
        trackedLink: { findFirst: vi.fn(), update: vi.fn().mockResolvedValue({}) },
        email: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
        emailEvent: { create: vi.fn().mockResolvedValue({}) },
        connectedMailbox: { update: vi.fn().mockResolvedValue({}) },
        sequenceStepRun: { findFirst: vi.fn() },
    },
    mockEnqueue: vi.fn().mockResolvedValue({ id: "job-1" }),
    mockAdvanceLead: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));
vi.mock("@/lib/crm/leadStageTransitions", () => ({ advanceLeadAfterEmailClicked: mockAdvanceLead }));

import { GET } from "./route";

function reqFor(trackingKey: string) {
    return new Request(`http://localhost/api/track/click/${trackingKey}`) as any;
}

describe("GET /api/track/click/[trackingKey]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.trackedLink.update.mockResolvedValue({});
        mockPrisma.emailEvent.create.mockResolvedValue({});
        mockAdvanceLead.mockResolvedValue(undefined);
        mockEnqueue.mockResolvedValue({ id: "job-1" });
    });

    it("enqueues a lead_rescore job on the first click of a tracked link with a lead", async () => {
        mockPrisma.trackedLink.findFirst.mockResolvedValue({
            id: "link-1",
            teamId: "team-1",
            emailId: "email-1",
            leadId: "lead-1",
            campaignId: "campaign-1",
            mailboxId: null,
            destinationUrl: "https://example.com",
            firstClickedAt: null,
        });
        mockPrisma.email.findUnique.mockResolvedValue({ clickedAt: null, leadId: "lead-1", campaignId: "campaign-1" });

        await GET(reqFor("key-1"), { params: Promise.resolve({ trackingKey: "key-1" }) });

        expect(mockEnqueue).toHaveBeenCalledWith("lead_rescore", { leadId: "lead-1", teamId: "team-1" });
    });

    it("does not enqueue a rescore when the email was already clicked before (dedup)", async () => {
        mockPrisma.trackedLink.findFirst.mockResolvedValue({
            id: "link-1",
            teamId: "team-1",
            emailId: "email-1",
            leadId: "lead-1",
            campaignId: "campaign-1",
            mailboxId: null,
            destinationUrl: "https://example.com",
            firstClickedAt: new Date(),
        });
        mockPrisma.email.findUnique.mockResolvedValue({ clickedAt: new Date(), leadId: "lead-1", campaignId: "campaign-1" });

        await GET(reqFor("key-1"), { params: Promise.resolve({ trackingKey: "key-1" }) });

        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("never blocks the redirect when enqueue fails", async () => {
        mockPrisma.trackedLink.findFirst.mockResolvedValue({
            id: "link-1",
            teamId: "team-1",
            emailId: "email-1",
            leadId: "lead-1",
            campaignId: "campaign-1",
            mailboxId: null,
            destinationUrl: "https://example.com",
            firstClickedAt: null,
        });
        mockPrisma.email.findUnique.mockResolvedValue({ clickedAt: null, leadId: "lead-1", campaignId: "campaign-1" });
        mockEnqueue.mockRejectedValueOnce(new Error("queue down"));

        const res = await GET(reqFor("key-1"), { params: Promise.resolve({ trackingKey: "key-1" }) });

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe("https://example.com/");
    });

    describe("creator funnel UTM on landing page links", () => {
        const link = (destinationUrl: string) => ({
            id: "link-1", teamId: "team-1", emailId: "email-1", leadId: "lead-1", campaignId: "campaign-1",
            mailboxId: null, destinationUrl, firstClickedAt: new Date(),
        });
        const redirectTo = async () => {
            const res = await GET(reqFor("key-1"), { params: Promise.resolve({ trackingKey: "key-1" }) });
            return new URL(res.headers.get("location") as string);
        };

        beforeEach(() => {
            mockPrisma.email.findUnique.mockResolvedValue({ clickedAt: new Date(), leadId: "lead-1", campaignId: "campaign-1" });
            mockPrisma.sequenceStepRun.findFirst.mockResolvedValue({ sequenceStepId: "step-2" });
        });

        it("tags a CMf /p/ link with email, sequence, the campaign and the step", async () => {
            mockPrisma.trackedLink.findFirst.mockResolvedValue(link("https://craftmyfunnel.live/p/free-guide?t=abc"));
            const url = await redirectTo();
            expect(url.origin + url.pathname).toBe("https://craftmyfunnel.live/p/free-guide");
            expect(Object.fromEntries(url.searchParams)).toEqual({
                t: "abc", utm_source: "email", utm_medium: "sequence", utm_campaign: "campaign-1", utm_content: "step-2",
            });
            expect(mockPrisma.sequenceStepRun.findFirst).toHaveBeenCalledWith({ where: { emailId: "email-1", teamId: "team-1" }, select: { sequenceStepId: true } });
        });

        it("keeps UTM the creator set, and leaves other sites and non-landing paths alone", async () => {
            mockPrisma.trackedLink.findFirst.mockResolvedValue(link("https://craftmyfunnel.live/p/guide?utm_source=newsletter"));
            expect((await redirectTo()).searchParams.get("utm_source")).toBe("newsletter");

            mockPrisma.trackedLink.findFirst.mockResolvedValue(link("https://example.com/p/guide"));
            expect((await redirectTo()).toString()).toBe("https://example.com/p/guide");
            mockPrisma.trackedLink.findFirst.mockResolvedValue(link("https://craftmyfunnel.live/pricing"));
            expect((await redirectTo()).toString()).toBe("https://craftmyfunnel.live/pricing");
        });

        it("still redirects to the plain link when the step lookup fails", async () => {
            mockPrisma.trackedLink.findFirst.mockResolvedValue(link("https://craftmyfunnel.live/p/guide"));
            mockPrisma.sequenceStepRun.findFirst.mockRejectedValue(new Error("db down"));
            expect((await redirectTo()).toString()).toBe("https://craftmyfunnel.live/p/guide");
        });
    });
});
