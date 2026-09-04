import { describe, expect, it, vi, beforeEach } from "vitest";
import { PATCH } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        notification: { updateMany: vi.fn() },
    },
}));

import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

function patchRequest() {
    return new Request("http://localhost:3001/api/notifications/notif-1", { method: "PATCH" });
}

describe("PATCH /api/notifications/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1" });
    });

    it("rejects an unauthenticated caller", async () => {
        (getCurrentContext as any).mockResolvedValue({ userId: null });

        const response = await PATCH(patchRequest(), { params: Promise.resolve({ id: "notif-1" }) });

        expect(response.status).toBe(401);
        expect(prisma.notification.updateMany).not.toHaveBeenCalled();
    });

    it("refuses to mark a notification that doesn't belong to the caller as read", async () => {
        (prisma.notification.updateMany as any).mockResolvedValue({ count: 0 });

        const response = await PATCH(patchRequest(), { params: Promise.resolve({ id: "notif-from-other-user" }) });

        expect(prisma.notification.updateMany).toHaveBeenCalledWith({
            where: { id: "notif-from-other-user", userId: "user-1" },
            data: { read: true },
        });
        expect(response.status).toBe(404);
    });

    it("marks the caller's own notification as read", async () => {
        (prisma.notification.updateMany as any).mockResolvedValue({ count: 1 });

        const response = await PATCH(patchRequest(), { params: Promise.resolve({ id: "notif-1" }) });

        expect(response.status).toBe(200);
    });
});
