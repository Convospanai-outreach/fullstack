import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetAdminUser, mockPrisma } = vi.hoisted(() => ({
    mockGetAdminUser: vi.fn(),
    mockPrisma: {
        clientError: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/admin", () => ({ getAdminUser: mockGetAdminUser }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { POST } from "./route";

describe("POST /admin/client-errors/export", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAdminUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", enterpriseRole: "SYSTEM_ADMIN" });
    });

    it("neutralizes formula-triggering cells reported by anonymous visitors (roadmap 3.5 / S-14)", async () => {
        mockPrisma.clientError.findMany.mockResolvedValue([
            {
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                message: '=HYPERLINK("http://evil.test","x")',
                url: "+https://example.test",
                userId: null,
                ip: "@1.2.3.4",
                userAgent: "-Mozilla",
            },
        ]);

        const res = await POST(
            new NextRequest("http://localhost/admin/client-errors/export", {
                method: "POST",
                body: JSON.stringify({ format: "csv" }),
            })
        );
        const row = (await res.text()).split("\n")[1];

        expect(row).toBe(
            `2026-01-01T00:00:00.000Z,"'=HYPERLINK(""http://evil.test"",""x"")","'+https://example.test","N/A","'@1.2.3.4","'-Mozilla"`
        );
    });

    it("neutralizes and quotes the userId, which the anonymous intake route also takes from the body", async () => {
        mockPrisma.clientError.findMany.mockResolvedValue([
            {
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                message: "m",
                url: "u",
                userId: '=1+1","injected',
                ip: "i",
                userAgent: "a",
            },
        ]);

        const res = await POST(
            new NextRequest("http://localhost/admin/client-errors/export", {
                method: "POST",
                body: JSON.stringify({ format: "csv" }),
            })
        );
        const row = (await res.text()).split("\n")[1];

        expect(row).toBe(`2026-01-01T00:00:00.000Z,"m","u","'=1+1"",""injected","i","a"`);
    });
});
