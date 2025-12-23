import { checkTeamPermission, TeamRole } from "../permissions";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
    prisma: {
        teamMember: {
            findFirst: jest.fn()
        }
    }
}));

describe("Permissions Logic", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should allow Admin to perform Member actions", async () => {
        (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({ role: TeamRole.ADMIN });

        const hasPermission = await checkTeamPermission("user-1", "team-1", TeamRole.MEMBER);
        expect(hasPermission).toBe(true);
    });

    it("should deny Member to perform Admin actions", async () => {
        (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({ role: TeamRole.MEMBER });

        const hasPermission = await checkTeamPermission("user-1", "team-1", TeamRole.ADMIN);
        expect(hasPermission).toBe(false);
    });

    it("should allow Owner to perform everything", async () => {
        (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue({ role: TeamRole.OWNER });

        expect(await checkTeamPermission("u1", "t1", TeamRole.ADMIN)).toBe(true);
        expect(await checkTeamPermission("u1", "t1", TeamRole.MEMBER)).toBe(true);
        expect(await checkTeamPermission("u1", "t1", TeamRole.VIEWER)).toBe(true);
    });

    it("should return false if not in team", async () => {
        (prisma.teamMember.findFirst as jest.Mock).mockResolvedValue(null);
        expect(await checkTeamPermission("u1", "t1", TeamRole.MEMBER)).toBe(false);
    });
});
