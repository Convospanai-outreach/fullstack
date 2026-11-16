import { describe, expect, it, vi, beforeEach } from "vitest";

// Minimal in-memory tables so processDue() runs its real claim/execute path against
// state that stopEnrollmentsForLead() actually mutated, instead of asserting on mocks.
const tables: Record<string, any[]> = vi.hoisted(() => ({}));

function matches(where: any = {}, row: any): boolean {
    return Object.entries(where).every(([key, condition]: [string, any]) => {
        if (key === "OR" || key === "AND") return true;
        if (key === "enrollment") return matches(condition, tables["sequenceEnrollment"].find((e) => e.id === row.enrollmentId) ?? {});
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

let stepBody = "<p>Hi Asha, a quick note about your support team.</p>";
let leadName: string | null = "Asha Rao";
let teamRow: any = { sendSafety: { mode: "hold" }, mailingAddress: "1 Main St, Pune" };

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
    mockDb.team = { findUnique: vi.fn(async () => teamRow) };
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

describe("pre-send gate in the sequence engine", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (emailService.sendEmail as any).mockResolvedValue({ success: true, deliveryProvider: "RESEND" });
        stepBody = "<p>Hi Asha, a quick note about your support team.</p>";
        leadName = "Asha Rao";
        teamRow = { sendSafety: { mode: "hold" }, mailingAddress: "1 Main St, Pune" };
        seed();
    });

    it("sends a healthy email untouched", async () => {
        await SequenceService.processDue({ now });
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
        expect(tables["sequenceStepRun"][0].status).toBe("SENT");
    });

    it("in hold mode holds a failing email on the same held screen, with the reasons", async () => {
        stepBody = "<p>Hi Asha, act now for a risk-free offer.</p>";
        seed();
        await SequenceService.processDue({ now });

        expect(emailService.sendEmail).not.toHaveBeenCalled();
        expect(tables["sequenceStepRun"][0]).toMatchObject({ status: "AWAITING_TOKEN_APPROVAL" });
        const saved = JSON.parse(tables["sequenceStepRun"][0].errorMessage);
        expect(saved.missing).toEqual([]);
        expect(saved.safety).toEqual([expect.objectContaining({ code: "BANNED_PHRASE" })]);
        expect(tables["sequenceEnrollment"][0]).toMatchObject({ status: "MANUAL_REVIEW", nextRunAt: null });
    });

    it("in warn mode (the default) sends the failing email anyway", async () => {
        stepBody = "<p>Hi Asha, act now for a risk-free offer.</p>";
        teamRow = { sendSafety: null, mailingAddress: "1 Main St, Pune" };
        seed();
        await SequenceService.processDue({ now });
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("in off mode does not look at the email", async () => {
        stepBody = "<p>Hi Asha, act now for a risk-free offer.</p>";
        teamRow = { sendSafety: { mode: "off" }, mailingAddress: null };
        seed();
        await SequenceService.processDue({ now });
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("sends once the sender approves a held email, without checking it again", async () => {
        stepBody = "<p>Hi Asha, act now for a risk-free offer.</p>";
        seed();
        await SequenceService.processDue({ now });
        expect(await SequenceService.approveTokenFallbacks("team-1", "run-1", now)).toEqual({ approved: true });
        await SequenceService.processDue({ now });
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("checks a run again when only its merge fields were approved", async () => {
        stepBody = "<p>Hi {{firstName}}, act now for a risk-free offer.</p>";
        leadName = "";
        seed();
        await SequenceService.processDue({ now });
        expect(JSON.parse(tables["sequenceStepRun"][0].errorMessage).missing.length).toBeGreaterThan(0);
        expect(await SequenceService.approveTokenFallbacks("team-1", "run-1", now)).toEqual({ approved: true });
        await SequenceService.processDue({ now });
        // The fields were approved, but nobody has seen the safety warnings yet, so it is held for them.
        expect(emailService.sendEmail).not.toHaveBeenCalled();
        expect(JSON.parse(tables["sequenceStepRun"][0].errorMessage).safety).toEqual([expect.objectContaining({ code: "BANNED_PHRASE" })]);
    });

    it("holds again on a re-check that changes nothing", async () => {
        stepBody = "<p>Hi Asha, act now for a risk-free offer.</p>";
        seed();
        await SequenceService.processDue({ now });
        await SequenceService.retryHeldTokens("team-1", "run-1", now);
        await SequenceService.processDue({ now });
        expect(emailService.sendEmail).not.toHaveBeenCalled();
        expect(tables["sequenceStepRun"][0].status).toBe("AWAITING_TOKEN_APPROVAL");
    });

    it("still sends when the team settings cannot be read", async () => {
        stepBody = "<p>Hi Asha, act now for a risk-free offer.</p>";
        seed();
        mockDb.team.findUnique.mockRejectedValue(new Error("db"));
        await SequenceService.processDue({ now });
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("checks the text after merge fields are filled, not the template", async () => {
        stepBody = "<p>Hi {{firstName}}, a quick note.</p>";
        seed();
        await SequenceService.processDue({ now });
        expect((emailService.sendEmail as any).mock.calls[0][2]).toBe("<p>Hi Asha, a quick note.</p>");
    });
});
