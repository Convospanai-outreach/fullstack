import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        schedule: { updateMany: vi.fn(), deleteMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    },
}));

import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
}

function patchRequest(body: unknown) {
    return new NextRequest("http://localhost:3001/api/schedules/x", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

describe("PATCH /api/schedules/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("strips teamId (and any other non-allow-listed field) from the update", async () => {
        (prisma.schedule.updateMany as any).mockResolvedValue({ count: 1 });
        (prisma.schedule.findUniqueOrThrow as any).mockResolvedValue({ id: "sched-1", teamId: "team-a" });

        await PATCH(patchRequest({ name: "Renamed", teamId: "team-b", id: "other-id", isActive: false }), ctx("sched-1"));

        expect(prisma.schedule.updateMany).toHaveBeenCalledWith({
            where: { id: "sched-1", teamId: "team-a" },
            data: { name: "Renamed", isActive: false },
        });
    });

    it("returns 404 when the schedule doesn't belong to the caller's team", async () => {
        (prisma.schedule.updateMany as any).mockResolvedValue({ count: 0 });

        const response = await PATCH(patchRequest({ name: "x" }), ctx("sched-from-team-b"));

        expect(response.status).toBe(404);
        expect(prisma.schedule.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it("updates a schedule belonging to the caller's own team", async () => {
        (prisma.schedule.updateMany as any).mockResolvedValue({ count: 1 });
        (prisma.schedule.findUniqueOrThrow as any).mockResolvedValue({ id: "sched-1", name: "Renamed" });

        const response = await PATCH(patchRequest({ name: "Renamed" }), ctx("sched-1"));

        expect(response.status).toBe(200);
    });
});

describe("DELETE /api/schedules/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("returns 404 when deleting a schedule from another team", async () => {
        (prisma.schedule.deleteMany as any).mockResolvedValue({ count: 0 });

        const response = await DELETE(new NextRequest("http://localhost/x"), ctx("sched-from-team-b"));

        expect(prisma.schedule.deleteMany).toHaveBeenCalledWith({ where: { id: "sched-from-team-b", teamId: "team-a" } });
        expect(response.status).toBe(404);
    });

    it("deletes a schedule belonging to the caller's own team", async () => {
        (prisma.schedule.deleteMany as any).mockResolvedValue({ count: 1 });

        const response = await DELETE(new NextRequest("http://localhost/x"), ctx("sched-1"));

        expect(response.status).toBe(200);
    });
});
