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
        row[key] = value && typeof value === "object" && "increment" in value ? (row[key] ?? 0) + value.increment
            : value && typeof value === "object" && "decrement" in value ? (row[key] ?? 0) - value.decrement : value;
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
let leadEmailStatus: string | undefined;
let teamRow: any = { sendSafety: { mode: "hold" }, mailingAddress: "1 Main St, Pune" };
let leadLocation: string | null = null;
let sequenceZone: string | undefined;

function seed() {
    // A lead a rep just marked not_interested: status LOST is not an exitReason, so only an
    // explicit stop keeps its already-scheduled follow-up from sending.
    const lead = { id: "lead-1", teamId: "team-1", email: "lead@example.test", status: "NEW", pipelineState: "NEW", fullName: leadName, company: "Acme", customFields: {}, location: leadLocation, emailStatus: leadEmailStatus };
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
            enrollment: { ...enrollment, lead, sequence: { timezone: sequenceZone }, campaign: { ownerId: "user-1" } },
        };
    });
}

describe("pre-send gate in the sequence engine", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (emailService.sendEmail as any).mockResolvedValue({ success: true, deliveryProvider: "RESEND" });
        stepBody = "<p>Hi Asha, a quick note about your support team.</p>";
        leadName = "Asha Rao";
        leadEmailStatus = undefined;
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

    describe("email status", () => {
        it("in hold mode holds a cold send to an unverified address, with the reason on the held screen", async () => {
            leadEmailStatus = "UNKNOWN";
            seed();
            await SequenceService.processDue({ now });
            expect(emailService.sendEmail).not.toHaveBeenCalled();
            expect(JSON.parse(tables["sequenceStepRun"][0].errorMessage).safety).toEqual([expect.objectContaining({ code: "EMAIL_NOT_VERIFIED" })]);
        });

        it("in hold mode sends to a verified address", async () => {
            leadEmailStatus = "VERIFIED";
            seed();
            await SequenceService.processDue({ now });
            expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
        });

        it("in warn mode sends to an unverified address but never to an undeliverable one", async () => {
            teamRow = { sendSafety: null, mailingAddress: "1 Main St, Pune" };
            leadEmailStatus = "UNKNOWN";
            seed();
            await SequenceService.processDue({ now });
            expect(emailService.sendEmail).toHaveBeenCalledTimes(1);

            vi.clearAllMocks();
            (emailService.sendEmail as any).mockResolvedValue({ success: true, deliveryProvider: "RESEND" });
            leadEmailStatus = "INVALID";
            seed();
            await SequenceService.processDue({ now });
            expect(emailService.sendEmail).not.toHaveBeenCalled();
            expect(JSON.parse(tables["sequenceStepRun"][0].errorMessage).safety).toEqual([expect.objectContaining({ code: "EMAIL_INVALID" })]);
        });
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

// `now` is Wed 2026-09-30 10:00Z: 15:30 in Kolkata (open), 19:00 in Tokyo (closed).
describe("recipient send window in the sequence engine", () => {
    const windowOn = { sendSafety: { mode: "off", sendWindow: { enabled: true } }, mailingAddress: null };

    beforeEach(() => {
        vi.clearAllMocks();
        (emailService.sendEmail as any).mockResolvedValue({ success: true, deliveryProvider: "RESEND" });
        stepBody = "<p>Hi Asha, a quick note about your support team.</p>";
        leadName = "Asha Rao";
        leadLocation = null;
        sequenceZone = undefined;
        teamRow = windowOn;
    });

    it("sends inside the recipient's window", async () => {
        leadLocation = "Pune, India";
        seed();
        await SequenceService.processDue({ now });
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("moves a send outside the window to the next window start, with jitter, and does not count it as an attempt", async () => {
        leadLocation = "Tokyo, Japan";
        seed();
        await SequenceService.processDue({ now });

        expect(emailService.sendEmail).not.toHaveBeenCalled();
        const run = tables["sequenceStepRun"][0];
        expect(run.status).toBe("SCHEDULED");
        expect(run.attemptCount).toBe(0);
        // Thu 08:00 Tokyo = Wed 23:00Z, plus under 90 minutes of jitter
        expect(run.scheduledAt.getTime()).toBeGreaterThanOrEqual(new Date("2026-09-30T23:00:00Z").getTime());
        expect(run.scheduledAt.getTime()).toBeLessThan(new Date("2026-10-01T00:30:00Z").getTime());
    });

    it("sends it when the window opens, and never dropped in between", async () => {
        leadLocation = "Tokyo, Japan";
        seed();
        await SequenceService.processDue({ now });
        await SequenceService.processDue({ now: new Date("2026-10-01T01:00:00Z") }); // 10:00 Tokyo Thursday
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("uses the sequence's own timezone when nothing is known about the recipient", async () => {
        sequenceZone = "Asia/Tokyo";
        seed();
        await SequenceService.processDue({ now });
        expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it("falls back to the window's own zone, not UTC, when the sequence's zone is not a real one", async () => {
        sequenceZone = "Not/AZone";
        // 10:00Z is inside a UTC window but 19:00 in Tokyo, so only the window's zone holds this send back.
        teamRow = { sendSafety: { mode: "off", sendWindow: { enabled: true, timeZone: "Asia/Tokyo" } }, mailingAddress: null };
        seed();
        await SequenceService.processDue({ now });
        expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it("does nothing unless the team turns it on", async () => {
        leadLocation = "Tokyo, Japan";
        teamRow = { sendSafety: { mode: "off" }, mailingAddress: null };
        seed();
        await SequenceService.processDue({ now });
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("sends when the team settings cannot be read", async () => {
        leadLocation = "Tokyo, Japan";
        seed();
        mockDb.team.findUnique.mockRejectedValue(new Error("db"));
        await SequenceService.processDue({ now });
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("keeps a sender's approval of a held email through a wait for the window", async () => {
        stepBody = "<p>Hi Asha, act now for a risk-free offer.</p>";
        leadLocation = "Tokyo, Japan";
        teamRow = { sendSafety: { mode: "hold" }, mailingAddress: "1 Main St" };
        seed();
        await SequenceService.processDue({ now }); // held for the banned phrase
        await SequenceService.approveTokenFallbacks("team-1", "run-1", now);
        teamRow = { sendSafety: { mode: "hold", sendWindow: { enabled: true } }, mailingAddress: "1 Main St" };
        await SequenceService.processDue({ now }); // 19:00 in Tokyo: waits
        expect(emailService.sendEmail).not.toHaveBeenCalled();
        expect(tables["sequenceStepRun"][0].errorCode).toBe("SAFETY_APPROVED");
        await SequenceService.processDue({ now: new Date("2026-10-01T01:00:00Z") });
        expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });
});
