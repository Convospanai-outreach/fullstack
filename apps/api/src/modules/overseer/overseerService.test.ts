import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockJudge } = vi.hoisted(() => ({
    mockPrisma: {
        overseerNudge: {
            findMany: vi.fn(),
            create: vi.fn(),
        },
        sequenceEnrollment: {
            findMany: vi.fn(),
        },
        breakerState: {
            findMany: vi.fn(),
        },
        team: {
            findMany: vi.fn(),
        },
    },
    mockJudge: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("./stallJudgment", () => ({
    judgeStalledEnrollments: mockJudge,
}));

import { runOverseerTick } from "./overseerService";

describe("runOverseerTick", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.overseerNudge.findMany.mockResolvedValue([]);
        mockPrisma.breakerState.findMany.mockResolvedValue([]);
        mockPrisma.team.findMany.mockResolvedValue([]);
    });

    it("does nothing and never calls the judge when no enrollments are stalled", async () => {
        mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);

        const result = await runOverseerTick();

        expect(result).toEqual({ candidates: 0, nudgesCreated: 0 });
        expect(mockJudge).not.toHaveBeenCalled();
        expect(mockPrisma.overseerNudge.create).not.toHaveBeenCalled();
    });

    it("excludes enrollments that already have an OPEN nudge", async () => {
        mockPrisma.overseerNudge.findMany.mockResolvedValue([{ enrollmentId: "enr-already-nudged" }]);
        mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);

        await runOverseerTick();

        const whereClause = mockPrisma.sequenceEnrollment.findMany.mock.calls[0][0].where;
        expect(whereClause.id.notIn).toEqual(["enr-already-nudged"]);
    });

    it("excludes teams whose circuit breaker is OPEN or HALF_OPEN (throttle)", async () => {
        mockPrisma.breakerState.findMany.mockResolvedValue([{ teamId: "team-backed-up" }]);
        mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([]);

        await runOverseerTick();

        const whereClause = mockPrisma.sequenceEnrollment.findMany.mock.calls[0][0].where;
        expect(whereClause.teamId.notIn).toEqual(["team-backed-up"]);
    });

    it("writes one OverseerNudge per judged candidate, scoped to the enrollment's team/lead/sequence", async () => {
        const lastRunAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
        mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
            {
                id: "enr-1",
                teamId: "team-1",
                leadId: "lead-1",
                sequenceId: "seq-1",
                currentStepOrder: 1,
                lastRunAt,
                startedAt: lastRunAt,
                sequence: { name: "Cold Outreach", _count: { steps: 5 } }
            }
        ]);
        mockJudge.mockReturnValue([
            { enrollmentId: "enr-1", nudgeType: "ROUTE_MANUAL", suggestion: "Stalled - route to manual." }
        ]);
        mockPrisma.overseerNudge.create.mockResolvedValue({});

        const result = await runOverseerTick();

        expect(result).toEqual({ candidates: 1, nudgesCreated: 1 });
        expect(mockJudge).toHaveBeenCalledWith([
            expect.objectContaining({ enrollmentId: "enr-1", sequenceName: "Cold Outreach", stage: "step 2 of 5" })
        ]);
        expect(mockPrisma.overseerNudge.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                teamId: "team-1",
                leadId: "lead-1",
                sequenceId: "seq-1",
                enrollmentId: "enr-1",
                nudgeType: "ROUTE_MANUAL"
            })
        });
    });

    describe("WhatsApp eligibility", () => {
        function stalledEnrollment(overrides: any = {}) {
            const lastRunAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
            return {
                id: "enr-1",
                teamId: "team-1",
                leadId: "lead-1",
                sequenceId: "seq-1",
                currentStepOrder: 1,
                lastRunAt,
                startedAt: lastRunAt,
                sequence: { name: "Cold Outreach", _count: { steps: 5 } },
                lead: { phone: "+15550001", whatsappConsent: true },
                ...overrides
            };
        }

        beforeEach(() => {
            mockJudge.mockReturnValue([{ enrollmentId: "enr-1", nudgeType: "TRY_WHATSAPP", suggestion: "Try WhatsApp." }]);
            mockPrisma.overseerNudge.create.mockResolvedValue({});
        });

        it("marks a candidate whatsappEligible when the team has WABA configured and the lead has phone + consent", async () => {
            mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([stalledEnrollment()]);
            mockPrisma.team.findMany.mockResolvedValue([{ id: "team-1", whatsappPhoneNumberId: "pn-1", whatsappAccessTokenEnc: { v: 1 } }]);

            await runOverseerTick();

            expect(mockJudge).toHaveBeenCalledWith([expect.objectContaining({ enrollmentId: "enr-1", whatsappEligible: true })]);
        });

        it.each([
            ["the team has no WABA configured", [], { phone: "+15550001", whatsappConsent: true }],
            ["the lead has no phone", [{ id: "team-1", whatsappPhoneNumberId: "pn-1", whatsappAccessTokenEnc: { v: 1 } }], { phone: null, whatsappConsent: true }],
            ["the lead hasn't consented", [{ id: "team-1", whatsappPhoneNumberId: "pn-1", whatsappAccessTokenEnc: { v: 1 } }], { phone: "+15550001", whatsappConsent: false }],
        ])("marks whatsappEligible false when %s", async (_label, teams, lead) => {
            mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([stalledEnrollment({ lead })]);
            mockPrisma.team.findMany.mockResolvedValue(teams);

            await runOverseerTick();

            expect(mockJudge).toHaveBeenCalledWith([expect.objectContaining({ enrollmentId: "enr-1", whatsappEligible: false })]);
        });

        it("persists a TRY_WHATSAPP nudge the judge returns for an eligible candidate", async () => {
            mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([stalledEnrollment()]);
            mockPrisma.team.findMany.mockResolvedValue([{ id: "team-1", whatsappPhoneNumberId: "pn-1", whatsappAccessTokenEnc: { v: 1 } }]);

            const result = await runOverseerTick();

            expect(result).toEqual({ candidates: 1, nudgesCreated: 1 });
            expect(mockPrisma.overseerNudge.create).toHaveBeenCalledWith({
                data: expect.objectContaining({ enrollmentId: "enr-1", nudgeType: "TRY_WHATSAPP" })
            });
        });
    });

    describe("replies since the enrollment started", () => {
        const startedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        const lastRunAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
        function stalledEnrollment(lead: any) {
            return {
                id: "enr-1", teamId: "team-1", leadId: "lead-1", sequenceId: "seq-1", currentStepOrder: 1,
                lastRunAt, startedAt, sequence: { name: "Cold Outreach", _count: { steps: 5 } }, lead
            };
        }
        const replyAt = (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

        beforeEach(() => {
            mockJudge.mockReturnValue([]);
        });

        it("passes the latest reply's classification, preferring a rep's correction", async () => {
            mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([stalledEnrollment({
                phone: null, whatsappConsent: false, messages: [{ createdAt: replyAt(2) }],
                replies: [{ receivedAt: replyAt(2), aiClassification: "INTERESTED", humanCorrection: "NOT_INTERESTED" }]
            })]);

            await runOverseerTick();

            expect(mockJudge).toHaveBeenCalledWith([expect.objectContaining({ replied: true, replyClassification: "NOT_INTERESTED" })]);
        });

        it("ignores a reply from before the enrollment started", async () => {
            mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([stalledEnrollment({
                phone: null, whatsappConsent: false, messages: [{ createdAt: replyAt(30) }],
                replies: [{ receivedAt: replyAt(30), aiClassification: "DNC", humanCorrection: null }]
            })]);

            await runOverseerTick();

            expect(mockJudge).toHaveBeenCalledWith([expect.objectContaining({ replied: false, replyClassification: null })]);
        });

        it("ignores a reply classified after the enrollment started when its message arrived before", async () => {
            mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([stalledEnrollment({
                phone: null, whatsappConsent: false, messages: [{ createdAt: replyAt(30) }],
                replies: [{ receivedAt: replyAt(2), aiClassification: "DNC", humanCorrection: null }]
            })]);

            await runOverseerTick();

            expect(mockJudge).toHaveBeenCalledWith([expect.objectContaining({ replied: false, replyClassification: null })]);
        });

        it("marks a reply with no classification yet as replied", async () => {
            mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([stalledEnrollment({ phone: null, whatsappConsent: false, messages: [{ createdAt: replyAt(1) }], replies: [] })]);

            await runOverseerTick();

            expect(mockJudge).toHaveBeenCalledWith([expect.objectContaining({ replied: true, replyClassification: null })]);
        });
    });
});
