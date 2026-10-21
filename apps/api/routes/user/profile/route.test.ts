import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext } = vi.hoisted(() => ({
    mockPrisma: {
        user: { findUnique: vi.fn(), update: vi.fn() },
        team: { findUnique: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));

import { GET, PUT } from "./route";

const STORED_USER = {
    id: "user-1",
    name: "Ada",
    email: "ada@example.com",
    image: null,
    address: "1 Main St",
    role: "user",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    password: "$2a$12$stored-bcrypt-hash",
};

// Behaves like Prisma: only the columns named in `select` come back.
function applySelect(row: Record<string, unknown>, args: { select?: Record<string, boolean> }) {
    if (!args.select) return { ...row };
    return Object.fromEntries(Object.entries(row).filter(([key]) => args.select![key]));
}

describe("/user/profile", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.user.findUnique.mockImplementation(async (args: any) => applySelect(STORED_USER, args));
        mockPrisma.user.update.mockImplementation(async (args: any) => applySelect(STORED_USER, args));
        mockPrisma.team.findUnique.mockResolvedValue({ credits: 42 });
    });

    it("GET returns the profile fields the page shows, without the password hash", async () => {
        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toMatchObject({
            id: "user-1",
            name: "Ada",
            email: "ada@example.com",
            address: "1 Main St",
            role: "user",
            credits: 42,
        });
        expect(body.createdAt).toBeDefined();
        expect(body).not.toHaveProperty("password");
    });

    it("PUT returns the updated profile without the password hash", async () => {
        const res = await PUT(
            new Request("http://localhost/user/profile", {
                method: "PUT",
                body: JSON.stringify({ name: "Ada L", image: null, address: "2 Main St" }),
            }),
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.name).toBe("Ada");
        expect(body).not.toHaveProperty("password");
    });

    it("401s without a session", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await GET();

        expect(res.status).toBe(401);
    });
});
