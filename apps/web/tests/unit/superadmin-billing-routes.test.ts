import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSuperAdminUserId, prisma, tx } = vi.hoisted(() => {
    const tx = {
        team: { findUnique: vi.fn(), update: vi.fn() },
        creditTransaction: { create: vi.fn() },
    };
    return {
        getSuperAdminUserId: vi.fn(),
        tx,
        prisma: {
            user: { findUnique: vi.fn() },
            superAdminAuditLog: { create: vi.fn() },
            subscription: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
            plan: { findUnique: vi.fn() },
            $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
        },
    };
});

vi.mock("@/lib/superadmin/session", () => ({ getSuperAdminUserId }));
vi.mock("@/lib/db", () => ({ prisma }));

import { POST as adjustCredits } from "../../src/app/api/superadmin/teams/[id]/credits/route";
import { PUT as setPlan } from "../../src/app/api/superadmin/users/[id]/plan/route";

const actor = { id: "sa-1", email: "ops@example.com", enterpriseRole: "SYSTEM_ADMIN", superAdminCredential: { id: "c" } };
const req = (method: string, body: unknown) => new Request("http://localhost/x", { method, body: JSON.stringify(body) }) as any;
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const auditActions = () => prisma.superAdminAuditLog.create.mock.calls.map(([arg]: any[]) => arg.data.action);

describe("superadmin billing controls", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSuperAdminUserId.mockResolvedValue("sa-1");
        prisma.user.findUnique.mockImplementation(async ({ where }: any) => (where.id === "sa-1" ? actor : { id: where.id }));
        tx.team.findUnique.mockResolvedValue({ credits: 100 });
        tx.team.update.mockImplementation(async ({ data }: any) => ({ credits: 100 + data.credits.increment }));
        prisma.subscription.findUnique.mockResolvedValue(null);
        prisma.plan.findUnique.mockResolvedValue({ id: "plan-pro", name: "PRO" });
    });

    it("needs a superadmin session", async () => {
        getSuperAdminUserId.mockResolvedValue(null);
        expect((await adjustCredits(req("POST", { amount: 5, reason: "x" }), params("t-1"))).status).toBe(401);
        expect((await setPlan(req("PUT", { planId: "plan-pro", days: 30, reason: "x" }), params("u-1"))).status).toBe(401);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("adjusts credits with a ledger row and audit, and never below zero", async () => {
        const res = await adjustCredits(req("POST", { amount: 250, reason: "goodwill after outage" }), params("t-1"));
        expect(await res.json()).toEqual({ credits: 350 });
        expect(tx.creditTransaction.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ teamId: "t-1", amount: 250, type: "admin_adjustment", meta: { superAdminUserId: "sa-1", reason: "goodwill after outage" } }),
        });
        expect(auditActions()).toEqual(["CREDITS_ADJUST"]);

        const tooMuch = await adjustCredits(req("POST", { amount: -101, reason: "clawback" }), params("t-1"));
        expect(tooMuch.status).toBe(400);
        expect(tx.team.update).toHaveBeenCalledTimes(1);

        expect((await adjustCredits(req("POST", { amount: 0, reason: "x" }), params("t-1"))).status).toBe(400);
        expect((await adjustCredits(req("POST", { amount: 1.5, reason: "x" }), params("t-1"))).status).toBe(400);
        expect((await adjustCredits(req("POST", { amount: 5 }), params("t-1"))).status).toBe(400);
        tx.team.findUnique.mockResolvedValue(null);
        expect((await adjustCredits(req("POST", { amount: 5, reason: "x" }), params("t-404"))).status).toBe(404);
    });

    it("puts a user on a plan as a manual subscription", async () => {
        const res = await setPlan(req("PUT", { planId: "plan-pro", days: 30, reason: "partner deal" }), params("u-1"));
        expect(res.status).toBe(200);
        expect(prisma.subscription.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId: "u-1" },
                create: expect.objectContaining({ planId: "plan-pro", status: "active", gateway: "MANUAL" }),
            })
        );
        expect(auditActions()).toEqual(["PLAN_SET"]);
        expect((await setPlan(req("PUT", { planId: "plan-pro", days: 0, reason: "x" }), params("u-1"))).status).toBe(400);
        expect((await setPlan(req("PUT", { planId: "plan-pro", days: 30 }), params("u-1"))).status).toBe(400);
        prisma.plan.findUnique.mockResolvedValue(null);
        expect((await setPlan(req("PUT", { planId: "nope", days: 30, reason: "x" }), params("u-1"))).status).toBe(400);
    });

    it("ends a plan, and refuses to touch one billed through Stripe", async () => {
        prisma.subscription.findUnique.mockResolvedValue({ planId: "plan-pro", status: "active", gateway: "MANUAL", externalSubscriptionId: null });
        expect((await setPlan(req("PUT", { planId: null, reason: "trial over" }), params("u-1"))).status).toBe(200);
        expect(prisma.subscription.update).toHaveBeenCalledWith({ where: { userId: "u-1" }, data: { status: "canceled", currentPeriodEnd: expect.any(Date) } });

        prisma.subscription.findUnique.mockResolvedValue({ planId: "plan-pro", status: "active", gateway: "STRIPE", externalSubscriptionId: "sub_123" });
        expect((await setPlan(req("PUT", { planId: "plan-pro", days: 30, reason: "x" }), params("u-1"))).status).toBe(409);
        expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    });
});
