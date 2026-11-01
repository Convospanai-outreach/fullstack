import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockJudge, mockJevJudge, mockLogger } = vi.hoisted(() => ({
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
        lead: {
            findFirst: vi.fn(),
        },
        featureFlag: {
            findMany: vi.fn(),
        },
    },
    mockJudge: vi.fn(),
    mockJevJudge: vi.fn(),
    mockLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/logger", () => ({
    logger: mockLogger,
}));

vi.mock("./stallJudgment", async (importOriginal) => ({
    ...(await importOriginal<typeof import("./stallJudgment")>()),
    judgeStalledEnrollments: mockJudge,
    judgeStalledEnrollmentsWithJev: mockJevJudge,
}));

// Masking stand-in: emails become [EMAIL], the lead's name becomes [PERSON].
vi.mock("@/lib/ai/SovereignFirewall", () => ({
    SovereignFirewall: {
        mask: async (text: string) => ({ safeContext: text.replace(/\S+@\S+/g, "[EMAIL]"), tokenMap: new Map() }),
        maskKnownNames: (text: string, names: { person?: string | null }) => ({
            safeContext: names.person ? text.split(names.person).join("[PERSON]") : text,
            tokenMap: new Map(),
        }),
    },
}));

vi.mock("@/modules/inbox/actionInboxService", () => ({
    toPlainText: (text: string) => text,
}));

import { runOverseerTick } from "./overseerService";

describe("runOverseerTick", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.overseerNudge.findMany.mockResolvedValue([]);
        mockPrisma.breakerState.findMany.mockResolvedValue([]);
        mockPrisma.team.findMany.mockResolvedValue([]);
        mockPrisma.featureFlag.findMany.mockResolvedValue([]);
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

    // Characterization: with the Jev flag off (no enabledFeatures on the team) the tick reads no
    // thread, calls no Jev code and writes exactly the rule's nudge.
    it("with the Jev flag off, writes exactly the rule's nudge and never reads a thread or calls Jev", async () => {
        const lastRunAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
        mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([
            {
                id: "enr-1", teamId: "team-1", leadId: "lead-1", sequenceId: "seq-1", currentStepOrder: 1,
                lastRunAt, startedAt: lastRunAt, sequence: { name: "Cold Outreach", _count: { steps: 5 } },
                lead: { phone: null, whatsappConsent: false, messages: [], replies: [] }
            }
        ]);
        mockPrisma.team.findMany.mockResolvedValue([{ id: "team-1", whatsappPhoneNumberId: null, whatsappAccessTokenEnc: null, enabledFeatures: null }]);
        mockJudge.mockReturnValue([{ enrollmentId: "enr-1", nudgeType: "ROUTE_MANUAL", suggestion: "rule text" }]);
        mockPrisma.overseerNudge.create.mockResolvedValue({});

        await runOverseerTick();

        expect(mockPrisma.overseerNudge.create).toHaveBeenCalledTimes(1);
        expect(mockPrisma.overseerNudge.create).toHaveBeenCalledWith({
            data: {
                teamId: "team-1",
                leadId: "lead-1",
                sequenceId: "seq-1",
                enrollmentId: "enr-1",
                stage: "step 2 of 5",
                stallDays: expect.any(Number),
                nudgeType: "ROUTE_MANUAL",
                suggestion: "rule text"
            }
        });
        expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
        expect(mockJevJudge).not.toHaveBeenCalled();
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

        it("marks a reply with no classification yet as replied", async () => {
            mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([stalledEnrollment({ phone: null, whatsappConsent: false, messages: [{ createdAt: replyAt(1) }], replies: [] })]);

            await runOverseerTick();

            expect(mockJudge).toHaveBeenCalledWith([expect.objectContaining({ replied: true, replyClassification: null })]);
        });
    });

    describe("Jev-judged stalls (per-team feature)", () => {
        const lastRunAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
        function enrollment(id: string, teamId: string, leadId: string) {
            return {
                id, teamId, leadId, sequenceId: "seq-1", currentStepOrder: 1, lastRunAt, startedAt: lastRunAt,
                sequence: { name: "Cold Outreach", _count: { steps: 5 } },
                lead: { phone: null, whatsappConsent: false, messages: [], replies: [] },
            };
        }
        const jevOn = { id: "team-1", whatsappPhoneNumberId: null, whatsappAccessTokenEnc: null };
        const jevOff = { id: "team-2", whatsappPhoneNumberId: null, whatsappAccessTokenEnc: null };

        beforeEach(() => {
            mockPrisma.overseerNudge.create.mockResolvedValue({});
            mockPrisma.featureFlag.findMany.mockResolvedValue([{ key: "overseer_jev_stall:team-1" }]);
            mockPrisma.sequenceEnrollment.findMany.mockResolvedValue([enrollment("enr-a", "team-1", "lead-a"), enrollment("enr-b", "team-2", "lead-b")]);
            mockPrisma.team.findMany.mockResolvedValue([jevOn, jevOff]);
            mockPrisma.lead.findFirst.mockResolvedValue({
                fullName: "Ada Lovelace",
                company: null,
                messages: [{ direction: "INBOUND", content: "Ada Lovelace here, mail ada@example.com", createdAt: new Date(Date.now() - 60_000) }],
                emails: [{ subject: "Hello", body: "Intro text", createdAt: new Date(Date.now() - 120_000) }],
            });
            mockJudge.mockReturnValue([{ enrollmentId: "enr-b", nudgeType: "ROUTE_MANUAL", suggestion: "rule for b" }]);
            mockJevJudge.mockResolvedValue({ judgments: [{ enrollmentId: "enr-a", nudgeType: "ROUTE_MANUAL", suggestion: "jev for a" }], logs: [] });
        });

        it("consults Jev only for the team that turned the feature on, and reads that team's lead only", async () => {
            await runOverseerTick();

            expect(mockPrisma.featureFlag.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: expect.objectContaining({ key: { in: expect.arrayContaining(["overseer_jev_stall:team-1", "overseer_jev_stall_shadow:team-2"]) } }) })
            );
            expect(mockJevJudge).toHaveBeenCalledTimes(1);
            expect(mockJevJudge.mock.calls[0][0]).toEqual([expect.objectContaining({ mode: "on", teamId: "team-1", candidate: expect.objectContaining({ enrollmentId: "enr-a" }) })]);
            expect(mockJudge).toHaveBeenCalledWith([expect.objectContaining({ enrollmentId: "enr-b" })]);
            expect(mockPrisma.lead.findFirst).toHaveBeenCalledTimes(1);
            expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead-a", teamId: "team-1" } }));
        });

        it("writes the nudges Jev and the rules decided, each for its own enrollment", async () => {
            const result = await runOverseerTick();

            expect(result).toEqual({ candidates: 2, nudgesCreated: 2 });
            expect(mockPrisma.overseerNudge.create).toHaveBeenCalledWith({ data: expect.objectContaining({ enrollmentId: "enr-a", suggestion: "jev for a" }) });
            expect(mockPrisma.overseerNudge.create).toHaveBeenCalledWith({ data: expect.objectContaining({ enrollmentId: "enr-b", suggestion: "rule for b" }) });
        });

        it("sends the thread masked: the lead's name and email do not reach Jev, and only the last five messages are sent", async () => {
            await runOverseerTick();

            const thread = mockJevJudge.mock.calls[0][0][0].thread;
            expect(JSON.stringify(thread)).not.toContain("ada@example.com");
            expect(JSON.stringify(thread)).not.toContain("Ada Lovelace");
            expect(thread).toEqual([
                { from: "us", text: "Subject: Hello\nIntro text" },
                { from: "lead", text: "[PERSON] here, mail [EMAIL]" },
            ]);
            expect(thread.length).toBeLessThanOrEqual(5);
        });

        it("logs the comparison it is given and nothing from the thread", async () => {
            mockJevJudge.mockResolvedValue({
                judgments: [],
                logs: [{ enrollmentId: "enr-a", mode: "on", rule: "ROUTE_MANUAL", jevNudge: "wait", applied: "jev", final: null, probabilities: { wait: 0.9 } }],
            });

            await runOverseerTick();

            expect(mockLogger.info).toHaveBeenCalledWith("[Overseer] Stall judgment", expect.objectContaining({ enrollmentId: "enr-a", jevNudge: "wait" }));
            expect(JSON.stringify(mockLogger.info.mock.calls)).not.toContain("ada@example.com");
        });

        it("skips Jev entirely when no team has the feature on", async () => {
            mockPrisma.featureFlag.findMany.mockResolvedValue([]);

            await runOverseerTick();

            expect(mockJevJudge).not.toHaveBeenCalled();
            expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
        });
    });
});
