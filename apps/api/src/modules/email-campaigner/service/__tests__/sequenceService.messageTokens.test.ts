import { describe, expect, it, vi, beforeEach } from "vitest";

// Minimal in-memory tables so processDue() runs its real claim/execute path against
// state that stopEnrollmentsForLead() actually mutated, instead of asserting on mocks.
const tables: Record<string, any[]> = vi.hoisted(() => ({}));

function matches(where: any = {}, row: any): boolean {
    return Object.entries(where).every(([key, condition]: [string, any]) => {
        if (key === "OR" || key === "AND") return true;
        if (condition && typeof condition === "object" && !(condition instanceof Date)) {
            if ("in" in condition) return condition.in.includes(row[key]);
            if ("lte" in condition) return row[key] != null && row[key] <= condition.lte;
            if ("not" in condition) return row[key] !== condition.not;
            return true;
        }
        return row[key] === condition;
    });
}

function applyData(row: any, data: any) {
    for (const [key, value] of Object.entries<any>(data)) {
        row[key] = value && typeof value === "object" && "increment" in value ? (row[key] ?? 0) + value.increment : value;
    }
}

function table(name: string) {
    return {
        findMany: vi.fn(async ({ where }: any = {}) => (tables[name] ?? []).filter((row) => matches(where, row))),
        findFirst: vi.fn(async ({ where }: any = {}) => (tables[name] ?? []).find((row) => matches(where, row)) ?? null),
        count: vi.fn(async ({ where }: any = {}) => (tables[name] ?? []).filter((row) => matches(where, row)).length),
        update: vi.fn(async ({ where, data }: any) => {
            const row = (tables[name] ?? []).find((candidate) => candidate.id === where.id);
            if (row) applyData(row, data);
            return row;
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
            const rows = (tables[name] ?? []).filter((row) => matches(where, row));
            rows.forEach((row) => applyData(row, data));
            return { count: rows.length };
        }),
    };
}

const mockDb: any = vi.hoisted(() => ({}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/email-campaigner", () => ({ emailService: { sendEmail: vi.fn() } }));
vi.mock("../googleMailboxService", () => ({
    assertMailboxCanSend: vi.fn().mockResolvedValue({ ok: true }),
    isSuppressed: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/crm/leadStageTransitions", () => ({
    advanceLeadAfterEmailSent: vi.fn().mockResolvedValue({ leadStageChanged: false }),
}));

import { SequenceService } from "../sequenceService";
import { emailService } from "@/modules/email-campaigner";

const now = new Date("2026-09-30T10:00:00Z");

let stepBody = "Hi {{firstName}}, just checking in";
let leadName: string | null = null;

function seed() {
    // A lead a rep just marked not_interested: status LOST is not an exitReason, so only an
    // explicit stop keeps its already-scheduled follow-up from sending.
    const lead = { id: "lead-1", teamId: "team-1", email: "lead@example.test", status: "NEW", pipelineState: "NEW", fullName: leadName, company: "Acme", customFields: {} };
    tables["lead"] = [lead];
    tables["sequenceEnrollment"] = [
        { id: "enrollment-1", teamId: "team-1", leadId: "lead-1", sequenceId: "seq-1", status: "ACTIVE", nextRunAt: null },
        { id: "enrollment-other-team", teamId: "team-2", leadId: "lead-1", sequenceId: "seq-2", status: "ACTIVE", nextRunAt: null },
    ];
    tables["sequenceStepRun"] = [
        {
            id: "run-1",
            teamId: "team-1",
            leadId: "lead-1",
            enrollmentId: "enrollment-1",
            sequenceStepId: "step-1",
            campaignId: "campaign-1",
            mailboxId: null,
            status: "SCHEDULED",
            scheduledAt: new Date("2026-09-30T09:00:00Z"),
            attemptCount: 0,
        },
    ];
    tables["sequenceStep"] = [];
    tables["sequenceEdge"] = [];
    tables["email"] = [];
    tables["campaignSequence"] = [];

    for (const name of Object.keys(tables)) mockDb[name] = table(name);
    mockDb.sequenceStepRun.findUnique = vi.fn(async ({ where }: any) => {
        const run = tables["sequenceStepRun"].find((row) => row.id === where.id);
        if (!run) return null;
        const enrollment = tables["sequenceEnrollment"].find((row) => row.id === run.enrollmentId);
        return {
            ...run,
            step: { id: "step-1", stepType: "email", subject: "Following up", body: stepBody },
            enrollment: { ...enrollment, lead, sequence: {}, campaign: { ownerId: "user-1" } },
        };
    });
}

describe("email steps with merge fields", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (emailService.sendEmail as any).mockResolvedValue({ success: true, deliveryProvider: "RESEND" });
        stepBody = "Hi {{firstName}}, just checking in";
        leadName = null;
        seed();
    });

    it("holds the email and records which fields are missing, instead of sending the literal text", async () => {
        await SequenceService.processDue({ now });

        expect(emailService.sendEmail).not.toHaveBeenCalled();
        expect(tables["sequenceStepRun"][0]).toMatchObject({ status: "AWAITING_TOKEN_APPROVAL", errorCode: "MISSING_TOKENS" });
        const saved = JSON.parse(tables["sequenceStepRun"][0].errorMessage);
        expect(saved.missing).toEqual([expect.objectContaining({ token: "firstName", reason: "empty", suggestedFallback: "there" })]);
        expect(tables["sequenceEnrollment"][0]).toMatchObject({ status: "MANUAL_REVIEW", nextRunAt: null });
    });

    it("sends with the suggested fallback once the sender approves", async () => {
        await SequenceService.processDue({ now });
        const result = await SequenceService.approveTokenFallbacks("team-1", "run-1", now);
        await SequenceService.processDue({ now });

        expect(result).toEqual({ approved: true });
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
        expect((emailService.sendEmail as any).mock.calls[0][2]).toBe("Hi there, just checking in");
    });

    it("cannot be approved when a field has no usable fallback, and nothing is sent", async () => {
        stepBody = "Hi {{firstName}}, how is {{property.industry}}?";
        seed();
        await SequenceService.processDue({ now });
        const result = await SequenceService.approveTokenFallbacks("team-1", "run-1", now);

        expect(result).toEqual({ approved: false, reason: "NEEDS_FIX", tokens: ["property.industry"] });
        expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it("only approves a run that belongs to the team and is waiting", async () => {
        await SequenceService.processDue({ now });
        expect(await SequenceService.approveTokenFallbacks("team-2", "run-1", now)).toEqual({ approved: false, reason: "NOT_WAITING" });
    });

    it("sends straight away when every field has a value or a fallback written in the step", async () => {
        leadName = "Asha Rao";
        stepBody = "Hi {{firstName}} from {{location|your city}}";
        seed();
        await SequenceService.processDue({ now });

        expect((emailService.sendEmail as any).mock.calls[0][2]).toBe("Hi Asha from your city");
    });
});
