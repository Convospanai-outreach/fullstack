import { vi, Mock } from "vitest";
import { getToken } from "next-auth/jwt";
import { prisma } from "@/lib/db";
import { getCurrentContextFromRequest } from "@/lib/auth";

vi.mock("@/lib/db", () => ({
    prisma: {
        teamMember: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

vi.mock("next-auth/jwt", () => ({
    getToken: vi.fn(),
}));

function requestWithWorkspaceCookie(teamId: string) {
    return new Request("https://api.example.com/leads", {
        headers: { cookie: `convo-workspace-id=${teamId}` },
    });
}

describe("getCurrentContextFromRequest membership status scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getToken as Mock).mockResolvedValue({ sub: "user_1" });
    });

    test("only accepts the workspace cookie for an active membership", async () => {
        (prisma.teamMember.findFirst as Mock).mockResolvedValue(null);
        (prisma.teamMember.findMany as Mock).mockResolvedValue([]);

        await getCurrentContextFromRequest(requestWithWorkspaceCookie("team_b"));

        // A deactivated or invited-but-not-joined row keeps its userId, so the
        // lookup must constrain on status rather than userId + teamId alone.
        expect(prisma.teamMember.findFirst).toHaveBeenCalledWith({
            where: { userId: "user_1", teamId: "team_b", status: "active" },
        });
    });

    test("falls back to null team when the only membership is not active", async () => {
        (prisma.teamMember.findFirst as Mock).mockResolvedValue(null);
        (prisma.teamMember.findMany as Mock).mockResolvedValue([]);

        const context = await getCurrentContextFromRequest(requestWithWorkspaceCookie("team_b"));

        expect(context).toEqual({ userId: "user_1", teamId: null });
    });

    test("only counts active memberships when resolving the default team", async () => {
        (prisma.teamMember.findFirst as Mock).mockResolvedValue(null);
        (prisma.teamMember.findMany as Mock).mockResolvedValue([{ teamId: "team_a" }]);

        const context = await getCurrentContextFromRequest(
            new Request("https://api.example.com/leads")
        );

        expect(prisma.teamMember.findMany).toHaveBeenCalledWith({
            where: { userId: "user_1", status: "active" },
            select: { teamId: true },
            take: 2,
        });
        expect(context).toEqual({ userId: "user_1", teamId: "team_a" });
    });

    test("resolves an active membership from the workspace cookie", async () => {
        (prisma.teamMember.findFirst as Mock).mockResolvedValue({ id: "tm_1", teamId: "team_b" });

        const context = await getCurrentContextFromRequest(requestWithWorkspaceCookie("team_b"));

        expect(context).toEqual({ userId: "user_1", teamId: "team_b" });
        expect(prisma.teamMember.findMany).not.toHaveBeenCalled();
    });
});
