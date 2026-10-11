import { describe, expect, it, vi, beforeEach } from "vitest";

// Small in-memory tables, so the real resume path (completeManualRun -> scheduleNextStep) runs
// against state it actually changed instead of being asserted on mock calls.
const tables: Record<string, any[]> = vi.hoisted(() => ({}));

function matches(where: any = {}, row: any): boolean {
    return Object.entries(where).every(([key, condition]: [string, any]) => {
        if (key === "enrollment") return matches(condition, tables["sequenceEnrollment"].find((item) => item.id === row.enrollmentId));
        if (condition && typeof condition === "object" && !(condition instanceof Date)) {
            if ("in" in condition) return condition.in.includes(row[key]);
            if ("gt" in condition) return row[key] > condition.gt;
            throw new Error(`unsupported condition on ${key}`);
        }
        return row[key] === condition;
    });
}

function table(name: string) {
    const rows = () => tables[name] ?? [];
    return {
        findMany: vi.fn(async ({ where }: any = {}) => rows().filter((row) => matches(where, row))),
        findFirst: vi.fn(async ({ where, orderBy }: any = {}) => {
            const found = rows().filter((row) => matches(where, row));
            if (orderBy?.stepOrder) found.sort((a, b) => a.stepOrder - b.stepOrder);
            return found[0] ?? null;
        }),
        findUnique: vi.fn(async ({ where }: any) => rows().find((row) => row.id === where.id) ?? null),
        count: vi.fn(async ({ where }: any = {}) => rows().filter((row) => matches(where, row)).length),
        create: vi.fn(async ({ data }: any) => {
            const row = { id: `${name}-${rows().length + 1}`, ...data };
            tables[name] = [...rows(), row];
            return row;
        }),
        update: vi.fn(async ({ where, data }: any) => {
            const row = rows().find((candidate) => candidate.id === where.id);
            if (row) Object.assign(row, data);
            return row;
        }),
        updateMany: vi.fn(async ({ where, data }: any) => {
            const found = rows().filter((row) => matches(where, row));
            found.forEach((row) => Object.assign(row, data));
            return { count: found.length };
        }),
    };
}

const mockDb: any = vi.hoisted(() => ({}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/email-campaigner", () => ({ emailService: { sendEmail: vi.fn() } }));
vi.mock("../googleMailboxService", () => ({ assertMailboxCanSend: vi.fn(), isSuppressed: vi.fn() }));
vi.mock("@/lib/crm/leadStageTransitions", () => ({ advanceLeadAfterEmailSent: vi.fn() }));
vi.mock("@/services/WhatsAppService", () => ({ WhatsAppService: { sendMessage: vi.fn() } }));
vi.mock("@/modules/whatsapp/ConsentService", () => ({ ConsentService: { validateConsent: vi.fn() } }));
vi.mock("@/modules/whatsapp/TemplateGuard", () => ({ TemplateGuard: { validateMessage: vi.fn() } }));
vi.mock("@/modules/whatsapp/wabaCredentials", () => ({ getTeamWabaConfig: vi.fn() }));

import { SequenceService } from "../sequenceService";

const now = new Date("2026-10-10T10:00:00Z");

function seed() {
    tables["lead"] = [{
        id: "lead-1", teamId: "team-1", status: "CONTACTED", pipelineState: "COLD",
        fullName: "Jane Doe", company: "Acme", linkedIn: "https://www.linkedin.com/in/jane-doe/",
    }];
    tables["sequenceStep"] = [
        { id: "step-li", sequenceId: "seq-1", stepType: "LI_INVITE", stepOrder: 1, status: "ACTIVE", body: "Hi Jane" },
        { id: "step-email", sequenceId: "seq-1", stepType: "EMAIL", stepOrder: 2, status: "ACTIVE", delayDays: 2, delayHours: 0 },
        { id: "step-wa", sequenceId: "seq-2", stepType: "WHATSAPP", stepOrder: 1, status: "ACTIVE" },
    ];
    tables["sequenceEdge"] = [];
    tables["sequenceEnrollment"] = [
        { id: "enrollment-1", teamId: "team-1", leadId: "lead-1", sequenceId: "seq-1", status: "MANUAL_REVIEW", nextRunAt: null, campaign: { ownerId: "user-1" } },
        { id: "enrollment-2", teamId: "team-1", leadId: "lead-1", sequenceId: "seq-2", status: "MANUAL_REVIEW", nextRunAt: null },
    ];
    tables["sequenceStepRun"] = [
        { id: "run-li", teamId: "team-1", leadId: "lead-1", enrollmentId: "enrollment-1", sequenceStepId: "step-li", status: "AWAITING_MANUAL_REVIEW" },
        { id: "run-wa", teamId: "team-1", leadId: "lead-1", enrollmentId: "enrollment-2", sequenceStepId: "step-wa", status: "AWAITING_MANUAL_REVIEW" },
    ];
    tables["task"] = [
        { id: "task-li", teamId: "team-1", sequenceStepRunId: "run-li", status: "TODO" },
        { id: "task-wa", teamId: "team-1", sequenceStepRunId: "run-wa", status: "TODO" },
        { id: "task-own", teamId: "team-1", sequenceStepRunId: null, status: "TODO" },
    ];
    tables["job"] = [
        { id: "job-li", teamId: "team-1", idempotencyKey: "ext_openprofile_run-li", status: "awaiting_extension" },
        { id: "job-other", teamId: "team-1", idempotencyKey: "ext_openprofile_run-other", status: "awaiting_extension" },
    ];
    tables["campaignSequence"] = [];

    for (const name of Object.keys(tables)) mockDb[name] = table(name);

    // Prisma's `include` / `select` of relations, which the plain tables above don't do.
    const withRelations = (run: any) => {
        if (!run) return null;
        const enrollment = tables["sequenceEnrollment"].find((row) => row.id === run.enrollmentId);
        return {
            ...run,
            step: tables["sequenceStep"].find((row) => row.id === run.sequenceStepId),
            lead: tables["lead"].find((row) => row.id === run.leadId),
            enrollment: { ...enrollment, lead: tables["lead"][0], sequence: { timezone: "UTC", name: "Outbound" } },
        };
    };
    const plainFindFirst = mockDb.sequenceStepRun.findFirst;
    mockDb.sequenceStepRun.findFirst = vi.fn(async (args: any) => {
        const run = await plainFindFirst(args);
        return args?.include || args?.select ? withRelations(run) : run;
    });
    const plainFindMany = mockDb.sequenceStepRun.findMany;
    mockDb.sequenceStepRun.findMany = vi.fn(async (args: any) => (await plainFindMany(args)).map(withRelations));
}

const row = (name: string, id: string) => tables[name].find((candidate) => candidate.id === id);
const runsFor = (stepId: string) => tables["sequenceStepRun"].filter((run) => run.sequenceStepId === stepId);

describe("SequenceService.completeManualRun", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        seed();
    });

    it("closes the step and schedules the next one after its delay", async () => {
        const result = await SequenceService.completeManualRun("team-1", "run-li", now);

        expect(result).toEqual({ resumed: true });
        expect(row("sequenceStepRun", "run-li").status).toBe("COMPLETED");
        expect(row("sequenceEnrollment", "enrollment-1")).toMatchObject({
            status: "ACTIVE",
            nextRunAt: new Date("2026-10-12T10:00:00Z"),
        });
        expect(runsFor("step-email")).toEqual([
            expect.objectContaining({ status: "SCHEDULED", scheduledAt: new Date("2026-10-12T10:00:00Z"), enrollmentId: "enrollment-1" }),
        ]);
    });

    it("closes the step's task and the extension's copy of it, and nothing else", async () => {
        await SequenceService.completeManualRun("team-1", "run-li", now);

        expect(row("task", "task-li").status).toBe("DONE");
        expect(row("job", "job-li")).toMatchObject({ status: "completed", completedAt: now });
        expect(row("task", "task-wa").status).toBe("TODO");
        expect(row("task", "task-own").status).toBe("TODO");
        expect(row("job", "job-other").status).toBe("awaiting_extension");
    });

    it("finishes the sequence when the manual step was its last", async () => {
        const result = await SequenceService.completeManualRun("team-1", "run-wa", now);

        expect(result).toEqual({ resumed: true });
        expect(row("sequenceEnrollment", "enrollment-2")).toMatchObject({ status: "COMPLETED", completedAt: now });
    });

    it("does nothing the second time", async () => {
        await SequenceService.completeManualRun("team-1", "run-li", now);
        const again = await SequenceService.completeManualRun("team-1", "run-li", now);

        expect(again).toEqual({ resumed: false });
        expect(runsFor("step-email")).toHaveLength(1);
    });

    it("leaves a sequence that has been stopped since stopped", async () => {
        row("sequenceEnrollment", "enrollment-1").status = "EXITED";

        const result = await SequenceService.completeManualRun("team-1", "run-li", now);

        expect(result).toEqual({ resumed: false });
        expect(row("sequenceEnrollment", "enrollment-1").status).toBe("EXITED");
        expect(row("sequenceStepRun", "run-li").status).toBe("COMPLETED");
        expect(runsFor("step-email")).toHaveLength(0);
    });

    it("exits instead of resuming when the lead has replied in the meantime", async () => {
        tables["lead"][0].status = "REPLIED";

        const result = await SequenceService.completeManualRun("team-1", "run-li", now);

        expect(result).toEqual({ resumed: false });
        expect(row("sequenceEnrollment", "enrollment-1")).toMatchObject({ status: "EXITED", nextRunAt: null });
        expect(runsFor("step-email")).toHaveLength(0);
    });

    it("does not touch another team's step", async () => {
        const result = await SequenceService.completeManualRun("team-2", "run-li", now);

        expect(result).toEqual({ resumed: false });
        expect(row("sequenceStepRun", "run-li").status).toBe("AWAITING_MANUAL_REVIEW");
        expect(row("sequenceEnrollment", "enrollment-1").status).toBe("MANUAL_REVIEW");
    });

    it("puts the step back when scheduling the next one fails, so it can be marked done again", async () => {
        mockDb.sequenceStepRun.create.mockRejectedValueOnce(new Error("db down"));

        await expect(SequenceService.completeManualRun("team-1", "run-li", now)).rejects.toThrow("db down");

        expect(row("sequenceStepRun", "run-li").status).toBe("AWAITING_MANUAL_REVIEW");
        expect(row("sequenceEnrollment", "enrollment-1").status).toBe("MANUAL_REVIEW");
        expect(await SequenceService.completeManualRun("team-1", "run-li", now)).toEqual({ resumed: true });
    });

    it("puts the sequence back when closing the step fails, so it can be marked done again", async () => {
        mockDb.sequenceStepRun.updateMany.mockRejectedValueOnce(new Error("db down"));

        await expect(SequenceService.completeManualRun("team-1", "run-li", now)).rejects.toThrow("db down");

        expect(row("sequenceStepRun", "run-li").status).toBe("AWAITING_MANUAL_REVIEW");
        expect(row("sequenceEnrollment", "enrollment-1").status).toBe("MANUAL_REVIEW");
        expect(await SequenceService.completeManualRun("team-1", "run-li", now)).toEqual({ resumed: true });
    });
});

describe("SequenceService.completeLinkedInRunsForLead", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        seed();
    });

    it("resumes only the sequences waiting on a LinkedIn step, and closes their tasks", async () => {
        const result = await SequenceService.completeLinkedInRunsForLead("team-1", "lead-1", now);

        expect(result).toEqual({ resumed: 1 });
        expect(row("sequenceEnrollment", "enrollment-1").status).toBe("ACTIVE");
        expect(row("task", "task-li").status).toBe("DONE");
        // The WhatsApp step is still waiting for its own task.
        expect(row("sequenceEnrollment", "enrollment-2").status).toBe("MANUAL_REVIEW");
        expect(row("task", "task-wa").status).toBe("TODO");
        expect(row("task", "task-own").status).toBe("TODO");
    });

    it("is a no-op for a lead with nothing waiting", async () => {
        const result = await SequenceService.completeLinkedInRunsForLead("team-1", "lead-other", now);

        expect(result).toEqual({ resumed: 0 });
        expect(mockDb.task.updateMany).not.toHaveBeenCalled();
    });
});

describe("SequenceService.listDueLinkedInSteps", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        seed();
    });

    it("lists the LinkedIn steps waiting on the campaign's owner, with what to do and what to say", async () => {
        const steps = await SequenceService.listDueLinkedInSteps("team-1", "user-1");

        // The WhatsApp step that is also waiting is not a LinkedIn step.
        expect(steps).toEqual([expect.objectContaining({
            runId: "run-li",
            leadId: "lead-1",
            name: "Jane Doe",
            company: "Acme",
            profileUrl: "https://www.linkedin.com/in/jane-doe/",
            action: "Send invitation",
            message: "Hi Jane",
            sequence: "Outbound",
        })]);
    });

    it("keeps another person's steps out of a teammate's list", async () => {
        expect(await SequenceService.listDueLinkedInSteps("team-1", "user-2")).toEqual([]);
    });

    it("shows a step whose campaign has no owner to everyone in the team", async () => {
        delete row("sequenceEnrollment", "enrollment-1").campaign;

        expect(await SequenceService.listDueLinkedInSteps("team-1", "user-2")).toHaveLength(1);
    });

    it("leaves out a step whose sequence has been stopped", async () => {
        row("sequenceEnrollment", "enrollment-1").status = "EXITED";

        expect(await SequenceService.listDueLinkedInSteps("team-1", "user-1")).toEqual([]);
    });

    it("leaves out a step once it is done, and another team's steps", async () => {
        expect(await SequenceService.listDueLinkedInSteps("team-2", "user-1")).toEqual([]);

        await SequenceService.completeManualRun("team-1", "run-li", now);

        expect(await SequenceService.listDueLinkedInSteps("team-1", "user-1")).toEqual([]);
    });
});

describe("SequenceService.findDueLinkedInStep", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        seed();
    });

    it("finds a waiting LinkedIn step and says whether it reaches the person", async () => {
        expect(await SequenceService.findDueLinkedInStep("team-1", "run-li", "user-1")).toEqual({
            leadId: "lead-1", action: "Send invitation", reachesPerson: true,
        });

        row("sequenceStep", "step-li").stepType = "LI_VISIT";
        expect(await SequenceService.findDueLinkedInStep("team-1", "run-li", "user-1")).toEqual({
            leadId: "lead-1", action: "Visit profile", reachesPerson: false,
        });
    });

    it("does not find a step of another kind, of another team, or one already done", async () => {
        expect(await SequenceService.findDueLinkedInStep("team-1", "run-wa", "user-1")).toBeNull();
        expect(await SequenceService.findDueLinkedInStep("team-2", "run-li", "user-1")).toBeNull();

        await SequenceService.completeManualRun("team-1", "run-li", now);
        expect(await SequenceService.findDueLinkedInStep("team-1", "run-li", "user-1")).toBeNull();
    });

    it("does not find another person's step, but finds one whose campaign has no owner", async () => {
        expect(await SequenceService.findDueLinkedInStep("team-1", "run-li", "user-2")).toBeNull();

        delete row("sequenceEnrollment", "enrollment-1").campaign;
        expect(await SequenceService.findDueLinkedInStep("team-1", "run-li", "user-2")).not.toBeNull();
    });
});
