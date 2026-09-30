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

function seed() {
    // A lead a rep just marked not_interested: status LOST is not an exitReason, so only an
    // explicit stop keeps its already-scheduled follow-up from sending.
    const lead = { id: "lead-1", teamId: "team-1", email: "lead@example.test", status: "LOST", pipelineState: "CLOSED_LOST" };
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
            step: { id: "step-1", stepType: "email", subject: "Following up", body: "Just checking in" },
            enrollment: { ...enrollment, lead, sequence: {}, campaign: { ownerId: "user-1" } },
        };
    });
}

describe("SequenceService.stopEnrollmentsForLead", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (emailService.sendEmail as any).mockResolvedValue({ success: true, deliveryProvider: "RESEND" });
        seed();
    });

    it("control: without an explicit stop, a pending run for a LOST lead still sends", async () => {
        await SequenceService.processDue({ now });

        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("keeps an already-scheduled run from sending once the lead's sequences are stopped", async () => {
        const result = await SequenceService.stopEnrollmentsForLead("team-1", "lead-1", "EXIT_REPLY_NOT_INTERESTED", now);
        await SequenceService.processDue({ now });

        expect(result).toEqual({ stopped: 1 });
        expect(emailService.sendEmail).not.toHaveBeenCalled();
        expect(tables["sequenceStepRun"][0]).toMatchObject({ status: "SKIPPED_EXITED", errorCode: "EXIT_REPLY_NOT_INTERESTED" });
        expect(tables["sequenceEnrollment"][0]).toMatchObject({ status: "EXITED", nextRunAt: null });
    });

    it("only touches the given team's enrollments", async () => {
        await SequenceService.stopEnrollmentsForLead("team-1", "lead-1", "EXIT_REPLY_INTERESTED", now);

        expect(tables["sequenceEnrollment"][1]).toMatchObject({ status: "ACTIVE" });
    });
});
