import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContextFromRequest: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        user: { findUnique: vi.fn() },
        lead: { findFirst: vi.fn() },
        message: { create: vi.fn() },
    },
}));

vi.mock("@/lib/queue", () => ({
    JobQueue: { enqueue: vi.fn() },
}));

vi.mock("@/modules/governance/service/guardrailService", () => ({
    guardrailService: {
        evaluate: vi.fn().mockResolvedValue({ isSafe: true, violations: [] }),
    },
}));

import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { JobQueue } from "@/lib/queue";

function postRequest(body: unknown) {
    return new NextRequest("http://localhost:3001/api/inbox/reply", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

describe("POST /api/inbox/reply", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (prisma.user.findUnique as any).mockResolvedValue({ name: "Me" });
    });

    it("refuses to reply to a lead from another team", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue(null);

        const response = await POST(postRequest({ leadId: "lead-from-team-b", content: "hi" }));

        expect(prisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead-from-team-b", teamId: "team-a" } });
        expect(prisma.message.create).not.toHaveBeenCalled();
        expect(response.status).toBe(404);
    });

    it("does not enqueue a LinkedIn send for a lead outside the caller's team", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue(null);

        await POST(postRequest({ leadId: "lead-from-team-b", content: "hi", platform: "LINKEDIN" }));

        expect(JobQueue.enqueue).not.toHaveBeenCalled();
    });

    it("sends a reply to a lead in the caller's own team", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1", linkedIn: "https://linkedin.com/in/lead-1" });
        (prisma.message.create as any).mockResolvedValue({ id: "msg-1" });

        const response = await POST(postRequest({ leadId: "lead-1", content: "hi", platform: "LINKEDIN" }));

        expect(prisma.message.create).toHaveBeenCalled();
        expect(JobQueue.enqueue).toHaveBeenCalledWith(
            "LINKEDIN_ACTION",
            expect.objectContaining({ profileUrl: "https://linkedin.com/in/lead-1" }),
            { teamId: "team-a" }
        );
        expect(response.status).toBe(200);
    });
});
