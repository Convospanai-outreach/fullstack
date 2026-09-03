import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        user: { findUnique: vi.fn() },
    },
}));

vi.mock("@/lib/inboxService", () => ({
    InboxService: {
        saveDraft: vi.fn(),
        discardDraft: vi.fn(),
    },
}));

import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InboxService } from "@/lib/inboxService";

function postRequest(body: unknown) {
    return new NextRequest("http://localhost:3001/api/inbox/drafts", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function deleteRequest(draftId: string) {
    return new NextRequest(`http://localhost:3001/api/inbox/drafts?draftId=${draftId}`, { method: "DELETE" });
}

describe("POST /api/inbox/drafts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (prisma.user.findUnique as any).mockResolvedValue({ name: "Agent" });
    });

    it("rejects when auth context has no teamId", async () => {
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: null });

        const response = await POST(postRequest({ leadId: "lead-1", content: "hi" }));

        expect(InboxService.saveDraft).not.toHaveBeenCalled();
        expect(response.status).toBe(401);
    });

    it("returns 404 when saving a draft against a lead outside the caller's team", async () => {
        (InboxService.saveDraft as any).mockRejectedValue(new Error("LEAD_NOT_FOUND"));

        const response = await POST(postRequest({ leadId: "lead-from-team-b", content: "hi" }));

        expect(InboxService.saveDraft).toHaveBeenCalledWith("lead-from-team-b", "hi", "Agent", "team-a");
        expect(response.status).toBe(404);
    });

    it("saves a draft for a lead in the caller's own team", async () => {
        (InboxService.saveDraft as any).mockResolvedValue({ id: "draft-1" });

        const response = await POST(postRequest({ leadId: "lead-1", content: "hi" }));

        expect(response.status).toBe(200);
    });
});

describe("DELETE /api/inbox/drafts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("returns 404 when discarding a draft outside the caller's team", async () => {
        (InboxService.discardDraft as any).mockRejectedValue(new Error("DRAFT_NOT_FOUND"));

        const response = await DELETE(deleteRequest("draft-from-team-b"));

        expect(InboxService.discardDraft).toHaveBeenCalledWith("draft-from-team-b", "team-a");
        expect(response.status).toBe(404);
    });

    it("discards a draft belonging to the caller's own team", async () => {
        (InboxService.discardDraft as any).mockResolvedValue({ id: "draft-1" });

        const response = await DELETE(deleteRequest("draft-1"));

        expect(response.status).toBe(200);
    });
});
