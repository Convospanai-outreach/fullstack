import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "@/app/api/superadmin/sending/route";

const { db, actor } = vi.hoisted(() => ({
    actor: vi.fn(),
    db: {
        team: { findUnique: vi.fn(), findMany: vi.fn() },
        teamMember: { findMany: vi.fn() },
        overseerNudge: { groupBy: vi.fn() },
        auditLog: { create: vi.fn() },
        superAdminAuditLog: { create: vi.fn() },
        notification: { createMany: vi.fn() },
        $queryRaw: vi.fn(), $executeRaw: vi.fn(), $transaction: vi.fn(),
    },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/superadmin/actor", () => ({ getSuperAdminActor: actor }));
const put = (reason: string) => PUT(new Request("https://app.example.test/api/superadmin/sending", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: "team", held: true, reason }),
}));

describe("superadmin sending controls", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        actor.mockResolvedValue({ id: "superadmin" });
        db.$transaction.mockImplementation(async (callback) => callback(db));
        db.team.findUnique.mockResolvedValue({ sendSafety: {} });
        db.teamMember.findMany.mockResolvedValue([{ userId: "team-admin" }]);
    });

    it("requires the dedicated superadmin session for reads and writes", async () => {
        actor.mockResolvedValue(null);
        expect((await GET()).status).toBe(401);
        expect((await put("complaint spike")).status).toBe(401);
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("requires a reason and records the hold, audit and notification together", async () => {
        expect((await put(" ")).status).toBe(400);
        expect(await (await put("complaint spike")).json()).toEqual({ held: true });
        expect(db.$executeRaw).toHaveBeenCalledTimes(1);
        expect(db.auditLog.create).toHaveBeenCalledWith({ data: {
            orgId: "team", actorId: "superadmin", action: "TEAM_SENDING_HELD", entity: "MailboxReputation", entityId: "team",
            metadata: { reason: "complaint spike" },
        } });
        expect(db.notification.createMany).toHaveBeenCalledWith(expect.objectContaining({
            data: [expect.objectContaining({ userId: "team-admin", type: "system" })],
        }));
    });

    it("returns counts and existing holds without customer lead data", async () => {
        db.team.findMany.mockResolvedValue([{ id: "team", name: "Example", sendSafety: { reputation: { sendingHold: { reason: "complaints" } } } }]);
        db.$queryRaw.mockResolvedValue([{ teamId: "team", sent: 218, bounced: 2, complained: 3, delayed: 1, failed: 1 }]);
        db.overseerNudge.groupBy.mockResolvedValue([{ teamId: "team", _count: { _all: 1 } }]);
        expect(await (await GET()).json()).toEqual({ teams: [{
            id: "team", name: "Example", sent: 218, bounced: 2, complained: 3, delayed: 1, failed: 1, incidents: 1, held: true,
        }] });
    });
});
