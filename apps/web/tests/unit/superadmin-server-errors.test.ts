import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSuperAdminUserId, findUnique, findMany, count, create, loggerMock } = vi.hoisted(() => ({
    getSuperAdminUserId: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    loggerMock: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/superadmin/session", () => ({ getSuperAdminUserId }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique }, serverError: { findMany, count, create } } }));

import { GET } from "../../src/app/api/superadmin/server-errors/route";
import { internalErrorMessage } from "../../src/lib/internalError";

const get = (query = "") => GET(new Request(`http://localhost/api/superadmin/server-errors${query}`) as any);

describe("/api/superadmin/server-errors", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSuperAdminUserId.mockResolvedValue("sa-1");
        findUnique.mockResolvedValue({ superAdminCredential: { id: "c-1" } });
        findMany.mockResolvedValue([{ id: "e-1", source: "api", label: "Upload failed", name: "Error", message: "boom", stack: null, createdAt: new Date() }]);
        count.mockResolvedValue(3);
    });

    it("needs a live superadmin session", async () => {
        getSuperAdminUserId.mockResolvedValue(null);
        expect((await get()).status).toBe(401);

        getSuperAdminUserId.mockResolvedValue("sa-1");
        findUnique.mockResolvedValue({ superAdminCredential: null });
        expect((await get()).status).toBe(401);
        expect(findMany).not.toHaveBeenCalled();
    });

    it("returns the newest errors, capped at 200, with the last-24h count", async () => {
        const res = await get("?limit=5000");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.last24h).toBe(3);
        expect(body.entries).toHaveLength(1);
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: "desc" }, take: 200 }));
    });
});

describe("internalErrorMessage (apps/web)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        create.mockResolvedValue({});
    });

    it("returns the fixed text and records the error as source web", async () => {
        expect(internalErrorMessage(new Error("relation missing"), "Upload failed")).toBe("Upload failed");
        await vi.waitFor(() => expect(create).toHaveBeenCalled());
        expect(create.mock.calls[0][0].data).toMatchObject({ source: "web", label: "Upload failed", name: "Error", message: "relation missing" });
    });
});
