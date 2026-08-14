import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findFirst: vi.fn(),
            update: vi.fn(),
            aggregate: vi.fn(),
        },
        task: {
            create: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
import { PipelineService, PipelineStage } from "../PipelineService";

describe("PipelineService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("moveLead", () => {
        it("throws when the lead doesn't belong to the team", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue(null);

            await expect(
                PipelineService.moveLead("team-1", "lead-1", PipelineStage.QUALIFIED)
            ).rejects.toThrow("Lead not found");
            expect(prisma.lead.update).not.toHaveBeenCalled();
        });

        it("updates pipelineState and stamps pipelineStateChangedAt", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1", teamId: "team-1" });
            (prisma.lead.update as any).mockResolvedValue({ id: "lead-1" });

            await PipelineService.moveLead("team-1", "lead-1", PipelineStage.CONTACTED);

            expect(prisma.lead.update).toHaveBeenCalledWith({
                where: { id: "lead-1" },
                data: expect.objectContaining({ pipelineState: "CONTACTED" }),
            });
        });

        it("sets wonAt when moved to WON and applies dealValue", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1", teamId: "team-1" });
            (prisma.lead.update as any).mockResolvedValue({ id: "lead-1" });

            await PipelineService.moveLead("team-1", "lead-1", PipelineStage.WON, 5000);

            const data = (prisma.lead.update as any).mock.calls[0][0].data;
            expect(data.pipelineState).toBe("WON");
            expect(data.value).toBe(5000);
            expect(data.wonAt).toBeInstanceOf(Date);
        });

        it("sets lostAt when moved to LOST", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1", teamId: "team-1" });
            (prisma.lead.update as any).mockResolvedValue({ id: "lead-1" });

            await PipelineService.moveLead("team-1", "lead-1", PipelineStage.LOST);

            const data = (prisma.lead.update as any).mock.calls[0][0].data;
            expect(data.lostAt).toBeInstanceOf(Date);
        });
    });

    describe("getPipelineStats", () => {
        it("sums lead value scoped to the team", async () => {
            (prisma.lead.aggregate as any).mockResolvedValue({ _sum: { value: 12500 } });

            const stats = await PipelineService.getPipelineStats("team-1");

            expect(prisma.lead.aggregate).toHaveBeenCalledWith({
                where: { teamId: "team-1" },
                _sum: { value: true },
            });
            expect(stats).toEqual({ totalValue: 12500 });
        });

        it("returns 0 when there are no leads", async () => {
            (prisma.lead.aggregate as any).mockResolvedValue({ _sum: { value: null } });

            const stats = await PipelineService.getPipelineStats("team-1");

            expect(stats).toEqual({ totalValue: 0 });
        });
    });

    describe("createTask", () => {
        it("creates a task scoped to the team and user", async () => {
            (prisma.task.create as any).mockResolvedValue({ id: "task-1" });

            await PipelineService.createTask({
                teamId: "team-1",
                userId: "user-1",
                leadId: "lead-1",
                title: "Call the lead",
                description: "Follow up",
                priority: "HIGH",
                dueDate: "2026-08-20T00:00:00.000Z",
            });

            expect(prisma.task.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    teamId: "team-1",
                    userId: "user-1",
                    leadId: "lead-1",
                    title: "Call the lead",
                    dueDate: new Date("2026-08-20T00:00:00.000Z"),
                }),
            });
        });
    });

    describe("getTasks", () => {
        it("scopes to the team and optionally a lead", async () => {
            (prisma.task.findMany as any).mockResolvedValue([]);

            await PipelineService.getTasks("team-1", "lead-1");

            expect(prisma.task.findMany).toHaveBeenCalledWith({
                where: { teamId: "team-1", leadId: "lead-1" },
                orderBy: { createdAt: "desc" },
            });
        });

        it("omits leadId from the filter when not provided", async () => {
            (prisma.task.findMany as any).mockResolvedValue([]);

            await PipelineService.getTasks("team-1");

            expect(prisma.task.findMany).toHaveBeenCalledWith({
                where: { teamId: "team-1" },
                orderBy: { createdAt: "desc" },
            });
        });
    });
});
