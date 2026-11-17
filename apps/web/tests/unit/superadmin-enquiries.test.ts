import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSuperAdminUserId, findUnique, count, groupBy, findMany, update, auditCreate } = vi.hoisted(() => ({
    getSuperAdminUserId: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    auditCreate: vi.fn(),
}));

vi.mock("@/lib/superadmin/session", () => ({ getSuperAdminUserId }));
vi.mock("@/lib/db", () => ({
    prisma: { user: { findUnique }, enquiry: { count, groupBy, findMany, update }, superAdminAuditLog: { create: auditCreate } },
}));

import { GET, PATCH } from "../../src/app/api/superadmin/enquiries/route";

const get = () => GET(new Request("http://localhost/api/superadmin/enquiries") as any);
const patch = (body: unknown) =>
    PATCH(new Request("http://localhost/api/superadmin/enquiries", { method: "PATCH", body: JSON.stringify(body) }) as any);

const at = (iso: string) => ({ createdAt: new Date(iso) });

describe("/api/superadmin/enquiries", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
        getSuperAdminUserId.mockResolvedValue("sa-1");
        findUnique.mockResolvedValue({ id: "sa-1", email: "sa@example.com", enterpriseRole: "ADMIN", superAdminCredential: { id: "c-1" } });
        auditCreate.mockResolvedValue({});
    });
    afterEach(() => vi.useRealTimers());

    it("needs a live superadmin session, for reading and for changing", async () => {
        getSuperAdminUserId.mockResolvedValue(null);
        expect((await get()).status).toBe(401);
        expect((await patch({ id: "e1", status: "CONTACTED" })).status).toBe(401);

        getSuperAdminUserId.mockResolvedValue("sa-1");
        findUnique.mockResolvedValue({ id: "sa-1", superAdminCredential: null });
        expect((await get()).status).toBe(401);
        expect(findMany).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    describe("GET", () => {
        beforeEach(() => {
            count.mockResolvedValue(9);
            groupBy.mockResolvedValue([
                { status: "NEW", _count: { _all: 4 } },
                { status: "CONTACTED", _count: { _all: 2 } },
            ]);
            findMany.mockImplementation(async (args: any) =>
                args.take === 10
                    ? [{ id: "e1", name: "Ada", email: "ada@example.com", subject: "Hi", message: "Hello", status: "NEW", createdAt: new Date("2026-10-29T01:00:00Z") }]
                    : [
                          at("2026-10-29T01:00:00Z"), // today
                          at("2026-10-28T23:00:00Z"), // yesterday
                          at("2026-10-24T10:00:00Z"), // inside the last 7 days
                          at("2026-10-09T10:00:00Z"), // this month, older than 7 days
                      ]
            );
        });

        it("counts enquiries for today, yesterday, the last 7 days and this month", async () => {
            const body = await (await get()).json();

            expect(body).toMatchObject({ today: 1, yesterday: 1, last7Days: 3, thisMonth: 4, total: 9, waiting: 4 });
        });

        it("fills in every status in the pipeline, including those with none", async () => {
            const { byStatus } = await (await get()).json();

            expect(byStatus).toEqual({ NEW: 4, CONTACTED: 2, QUALIFIED: 0, CONVERTED: 0, NOT_INTERESTED: 0 });
        });

        it("gives one entry per day for the last 14 days, oldest first", async () => {
            const { daily } = await (await get()).json();

            expect(daily).toHaveLength(14);
            expect(daily[0].date).toBe("2026-10-16");
            expect(daily[13]).toEqual({ date: "2026-10-29", count: 1 });
            expect(daily.find((d: any) => d.date === "2026-10-28").count).toBe(1);
            expect(daily.find((d: any) => d.date === "2026-10-24").count).toBe(1);
        });

        it("lists the 10 newest enquiries and records that the list was viewed, without their content", async () => {
            const { latest } = await (await get()).json();

            expect(latest).toHaveLength(1);
            expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: "desc" }, take: 10 }));
            expect(auditCreate).toHaveBeenCalledTimes(1);
            const row = auditCreate.mock.calls[0]![0].data;
            expect(row).toMatchObject({ userId: "sa-1", action: "VIEW_ENQUIRIES" });
            expect(JSON.stringify(row)).not.toContain("ada@example.com");
        });
    });

    describe("PATCH", () => {
        it("moves an enquiry to a new status and records who did it, with the id and status only", async () => {
            update.mockResolvedValue({ id: "e1", status: "CONTACTED" });

            const res = await patch({ id: "e1", status: "CONTACTED" });

            expect(res.status).toBe(200);
            expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "e1" }, data: { status: "CONTACTED" } }));
            expect(auditCreate.mock.calls[0]![0].data).toMatchObject({
                userId: "sa-1",
                action: "ENQUIRY_STATUS",
                metadata: { id: "e1", status: "CONTACTED" },
            });
        });

        it.each([
            ["an unknown status", { id: "e1", status: "DONE" }],
            ["no status", { id: "e1" }],
            ["no id", { status: "NEW" }],
            ["a non-text id", { id: 5, status: "NEW" }],
        ])("rejects %s without changing anything", async (_label, body) => {
            const res = await patch(body);

            expect(res.status).toBe(400);
            expect(update).not.toHaveBeenCalled();
            expect(auditCreate).not.toHaveBeenCalled();
        });

        it("does not change the status when the record of it cannot be written", async () => {
            auditCreate.mockRejectedValue(new Error("db down"));

            const res = await patch({ id: "e1", status: "CONTACTED" });

            expect(res.status).toBe(500);
            expect(update).not.toHaveBeenCalled();
        });

        it("says not found for an enquiry that does not exist", async () => {
            update.mockRejectedValue(Object.assign(new Error("missing"), { code: "P2025" }));

            expect((await patch({ id: "gone", status: "NEW" })).status).toBe(404);
        });
    });
});
