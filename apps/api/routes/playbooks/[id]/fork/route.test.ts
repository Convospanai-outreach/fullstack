import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        playbook: { findFirst: vi.fn(), create: vi.fn() },
    },
}));

vi.mock("@/lib/governance/audit", () => ({
    audit: vi.fn().mockResolvedValue(undefined),
}));

import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("POST /api/playbooks/[id]/fork", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("refuses to fork a playbook belonging to another team", async () => {
        (prisma.playbook.findFirst as any).mockResolvedValue(null);

        const response = await POST(new Request("http://localhost/x"), ctx("playbook-from-team-b"));

        expect(prisma.playbook.findFirst).toHaveBeenCalledWith({
            where: { id: "playbook-from-team-b", teamId: "team-a" },
        });
        expect(prisma.playbook.create).not.toHaveBeenCalled();
        expect(response.status).toBe(404);
    });

    it("forks a playbook belonging to the caller's own team", async () => {
        (prisma.playbook.findFirst as any).mockResolvedValue({
            id: "playbook-1",
            name: "Original",
            description: "desc",
            config: { steps: [] },
            parameters: null,
            teamId: "team-a",
        });
        (prisma.playbook.create as any).mockResolvedValue({ id: "fork-1", name: "Copy of Original" });

        const response = await POST(new Request("http://localhost/x"), ctx("playbook-1"));

        expect(prisma.playbook.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name: "Copy of Original",
                teamId: "team-a",
                visibility: "INTERNAL",
            }),
        });
        expect(response.status).toBe(200);
    });
});
