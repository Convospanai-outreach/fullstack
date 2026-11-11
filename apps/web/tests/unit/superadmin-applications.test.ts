import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSuperAdminUserId, findUnique, count, groupBy, findMany, update, findUniqueApp, auditCreate } = vi.hoisted(() => ({
    getSuperAdminUserId: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    findUniqueApp: vi.fn(),
    auditCreate: vi.fn(),
}));

vi.mock("@/lib/superadmin/session", () => ({ getSuperAdminUserId }));
vi.mock("@/lib/db", () => ({
    prisma: {
        user: { findUnique },
        jobApplication: { count, groupBy, findMany, update, findUnique: findUniqueApp },
        superAdminAuditLog: { create: auditCreate },
    },
}));

import { GET, PATCH } from "../../src/app/api/superadmin/applications/route";
import { GET as downloadResume } from "../../src/app/api/superadmin/applications/[id]/resume/route";

const get = () => GET(new Request("http://localhost/api/superadmin/applications") as any);
const patch = (body: unknown) =>
    PATCH(new Request("http://localhost/api/superadmin/applications", { method: "PATCH", body: JSON.stringify(body) }) as any);
const resume = (id = "a1") => downloadResume(new Request(`http://localhost/api/superadmin/applications/${id}/resume`) as any, { params: Promise.resolve({ id }) });

describe("/api/superadmin/applications", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSuperAdminUserId.mockResolvedValue("sa-1");
        findUnique.mockResolvedValue({ id: "sa-1", email: "sa@example.com", enterpriseRole: "ADMIN", superAdminCredential: { id: "c-1" } });
        auditCreate.mockResolvedValue({});
    });

    it("needs a live superadmin session for the list, the status change and the resume", async () => {
        getSuperAdminUserId.mockResolvedValue(null);

        expect((await get()).status).toBe(401);
        expect((await patch({ id: "a1", status: "REVIEWING" })).status).toBe(401);
        expect((await resume()).status).toBe(401);
        expect(findMany).not.toHaveBeenCalled();
        expect(findUniqueApp).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });

    describe("GET", () => {
        beforeEach(() => {
            count.mockResolvedValue(3);
            groupBy.mockResolvedValue([{ status: "NEW", _count: { _all: 2 } }]);
            findMany.mockResolvedValue([{ id: "a1", jobTitle: "SDR", name: "Ada", email: "ada@example.com", status: "NEW", resumeName: "cv.pdf", resumeSize: 10, createdAt: new Date() }]);
        });

        it("returns the total, a count for every status and the newest applications, never the resume bytes", async () => {
            const body = await (await get()).json();

            expect(body.total).toBe(3);
            expect(body.byStatus).toEqual({ NEW: 2, REVIEWING: 0, SHORTLISTED: 0, REJECTED: 0, HIRED: 0 });
            expect(body.latest).toHaveLength(1);
            const select = findMany.mock.calls[0]![0].select;
            expect(select).not.toHaveProperty("resumeData");
            expect(findMany.mock.calls[0]![0]).toMatchObject({ orderBy: { createdAt: "desc" }, take: 50 });
        });

        it("records that the list was viewed without the applicants' details", async () => {
            await get();

            const row = auditCreate.mock.calls[0]![0].data;
            expect(row).toMatchObject({ userId: "sa-1", action: "VIEW_APPLICATIONS" });
            expect(JSON.stringify(row)).not.toContain("ada@example.com");
        });
    });

    describe("PATCH", () => {
        it("changes the status and records it first, with the id and status only", async () => {
            update.mockResolvedValue({ id: "a1", status: "SHORTLISTED" });

            const res = await patch({ id: "a1", status: "SHORTLISTED" });

            expect(res.status).toBe(200);
            expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "a1" }, data: { status: "SHORTLISTED" } }));
            expect(auditCreate.mock.calls[0]![0].data).toMatchObject({ action: "APPLICATION_STATUS", metadata: { id: "a1", status: "SHORTLISTED" } });
        });

        it.each([
            ["an unknown status", { id: "a1", status: "MAYBE" }],
            ["no id", { status: "NEW" }],
        ])("rejects %s", async (_label, body) => {
            expect((await patch(body)).status).toBe(400);
            expect(update).not.toHaveBeenCalled();
        });

        it("does not change the status when the record of it cannot be written", async () => {
            auditCreate.mockRejectedValue(new Error("db down"));

            expect((await patch({ id: "a1", status: "NEW" })).status).toBe(500);
            expect(update).not.toHaveBeenCalled();
        });
    });

    describe("resume download", () => {
        it("serves the stored file as an attachment that cannot be rendered by the browser, and records the download", async () => {
            findUniqueApp.mockResolvedValue({ id: "a1", resumeName: 'evil"\r\nname.pdf', resumeType: "application/pdf", resumeData: Buffer.from("%PDF-1.7 hi") });

            const res = await resume();

            expect(res.status).toBe(200);
            expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("%PDF-1.7 hi");
            expect(res.headers.get("content-type")).toBe("application/pdf");
            expect(res.headers.get("x-content-type-options")).toBe("nosniff");
            expect(res.headers.get("cache-control")).toContain("no-store");
            const disposition = res.headers.get("content-disposition")!;
            expect(disposition).toMatch(/^attachment; filename="/);
            expect(disposition).not.toMatch(/[\r\n]/);
            expect(disposition.slice("attachment; filename=\"".length, -1)).not.toContain('"');
            expect(auditCreate.mock.calls[0]![0].data).toMatchObject({ action: "DOWNLOAD_RESUME", metadata: { id: "a1" } });
        });

        it("says not found for an application that does not exist", async () => {
            findUniqueApp.mockResolvedValue(null);

            expect((await resume("nope")).status).toBe(404);
        });
    });
});
