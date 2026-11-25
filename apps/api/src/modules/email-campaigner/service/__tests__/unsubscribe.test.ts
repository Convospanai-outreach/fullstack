import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../../../../routes/email/unsubscribe/[trackingId]/route";
import { isPublicRoutePath } from "@/lib/publicRoutes";

const { tx, prisma } = vi.hoisted(() => {
    const tx = {
        email: { updateMany: vi.fn() },
        suppressionEntry: { upsert: vi.fn() },
        lead: { updateMany: vi.fn(), findMany: vi.fn().mockResolvedValue([{ id: "lead" }]) },
        sequenceEnrollment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        sequenceStepRun: { updateMany: vi.fn() },
        message: { findMany: vi.fn().mockResolvedValue([{ id: "inbound" }]) },
        job: {
            findMany: vi.fn().mockResolvedValue([{ id: "job", idempotencyKey: "scheduled_inbox_reply:team:inbound" }]),
            updateMany: vi.fn(),
        },
        emailEvent: { createMany: vi.fn() },
    };
    const prisma = {
        email: { findUnique: vi.fn() },
        emailEvent: { findFirst: vi.fn().mockResolvedValue(null) },
        $transaction: vi.fn(async (work: (client: typeof tx) => Promise<void>) => work(tx)),
    };
    return { prisma, tx };
});
vi.mock("@/lib/db", () => ({ prisma }));

const token = "tracking-example";
const email = { id: "sent", leadId: "lead", mailboxId: "mailbox", campaignId: "campaign", campaign: { teamId: "team" }, lead: { teamId: "team", email: "Recipient@example.test" } };
function post(id = token) {
    const request = new Request("https://app.example.test/api/email/unsubscribe/" + id, {
        method: "POST",
        body: new URLSearchParams({ "List-Unsubscribe": "One-Click" }),
    });
    return POST(request as Parameters<typeof POST>[0], { params: Promise.resolve({ trackingId: id }) });
}

describe("one-click unsubscribe", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prisma.email.findUnique.mockResolvedValue(email);
    });

    it("allows anonymous POST and records suppression, sequence exit and scheduled-reply cancellation together", async () => {
        expect(isPublicRoutePath("/email/unsubscribe/[trackingId]")).toBe(true);
        expect((await post()).status).toBe(200);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(tx.suppressionEntry.upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { teamId_email: { teamId: "team", email: "recipient@example.test" } },
            create: expect.objectContaining({ reason: "UNSUBSCRIBE" }),
        }));
        expect(tx.lead.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "OPT_OUT" } }));
        expect(tx.sequenceEnrollment.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ teamId: "team", leadId: "lead" }),
            data: expect.objectContaining({ status: "EXITED", nextRunAt: null, exitReason: "unsubscribed" }),
        }));
        expect(tx.sequenceStepRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: "SKIPPED_EXITED", errorCode: "EXIT_UNSUBSCRIBED" }),
        }));
        expect(tx.job.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "job", status: { in: ["queued", "pending"] } },
            data: expect.objectContaining({ status: "cancelled", payload: {}, result: { cancelledReplyId: "inbound" } }),
        }));
        expect(tx.emailEvent.createMany).toHaveBeenCalledWith({
            data: [expect.objectContaining({ type: "UNSUBSCRIBED", providerMessageId: "unsubscribe:sent" })],
            skipDuplicates: true,
        });
    });

    it("uses the same terminal response and event identity on replay", async () => {
        const first = await post();
        const repeat = await post();
        expect(repeat.status).toBe(200);
        expect(await repeat.text()).toBe(await first.text());
        expect(tx.emailEvent.createMany.mock.calls[1]).toEqual(tx.emailEvent.createMany.mock.calls[0]);
        expect(tx.email.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "sent", unsubscribedAt: null } }));
    });

    it("returns 200 without writes for unknown or other-team recipients", async () => {
        prisma.email.findUnique.mockResolvedValue(null);
        const unknown = await post();
        prisma.email.findUnique.mockResolvedValue({ ...email, lead: { ...email.lead, teamId: "other-team" } });
        const mismatch = await post();
        expect(unknown.status).toBe(200);
        expect(mismatch.status).toBe(200);
        expect(await mismatch.text()).toBe(await unknown.text());
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("suppresses a team recipient from a nurture send with no campaign", async () => {
        prisma.email.findUnique.mockResolvedValue(null);
        prisma.emailEvent.findFirst.mockResolvedValueOnce({ teamId: "team", leadId: null, payload: { recipient: "recipient@example.test" } });
        expect((await post()).status).toBe(200);
        expect(tx.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team", email: { equals: "recipient@example.test", mode: "insensitive" } } }));
        expect(tx.emailEvent.createMany).toHaveBeenCalledWith(expect.objectContaining({
            data: [expect.objectContaining({ emailId: null, type: "UNSUBSCRIBED" })],
        }));
    });

    it("keeps rate limiting repeated hits on one token and still answers 200", async () => {
        const id = "rate-limited-token";
        for (let i = 0; i < 10; i++) expect((await post(id)).status).toBe(200);
        prisma.$transaction.mockClear();
        expect((await post(id)).status).toBe(200);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("returns a retryable response when persistence fails", async () => {
        prisma.$transaction.mockRejectedValueOnce(new Error("database offline"));
        const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
        try {
            expect((await post()).status).toBe(503);
        } finally {
            error.mockRestore();
        }
    });
});
