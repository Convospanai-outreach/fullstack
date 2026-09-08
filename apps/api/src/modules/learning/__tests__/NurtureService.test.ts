import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        calendarEvent: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
        lead: {
            findMany: vi.fn(),
        },
        teamMember: {
            findFirst: vi.fn(),
        },
        task: {
            create: vi.fn(),
        },
    },
}));

vi.mock("@/lib/ai/flows/calendar_nurture_flow", () => ({
    calendarNurtureFlow: {
        run: vi.fn(),
    },
}));

import { prisma } from "@/lib/db";
import { calendarNurtureFlow } from "@/lib/ai/flows/calendar_nurture_flow";
import { NurtureService } from "../NurtureService";

describe("NurtureService", () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.clearAllMocks();
        fetchSpy = vi.spyOn(global, "fetch" as any).mockRejectedValue(new Error("fetch should not be called"));
    });

    describe("syncEvents", () => {
        it("queries CalendarEvent for the exact [year, year+1) window instead of self-fetching", async () => {
            (prisma.calendarEvent.findMany as any).mockResolvedValue([{ id: "evt-1", eventDate: new Date("2026-06-01") }]);

            const result = await NurtureService.syncEvents(2026);

            expect(fetchSpy).not.toHaveBeenCalled();
            expect(prisma.calendarEvent.findMany).toHaveBeenCalledWith({
                where: {
                    eventDate: {
                        gte: new Date(Date.UTC(2026, 0, 1)),
                        lt: new Date(Date.UTC(2027, 0, 1)),
                    },
                },
                orderBy: { eventDate: "asc" },
            });
            expect(result).toEqual({ calendarEvents: [{ id: "evt-1", eventDate: new Date("2026-06-01") }] });
        });

        it("returns an empty list honestly when nothing is seeded for the year", async () => {
            (prisma.calendarEvent.findMany as any).mockResolvedValue([]);

            const result = await NurtureService.syncEvents(2030);

            expect(result).toEqual({ calendarEvents: [] });
        });
    });

    describe("generateNurtureTasks", () => {
        const event = { id: "evt-1", eventName: "Diwali", eventDate: new Date("2026-11-01"), leadGenAngle: "Festive outreach" };
        const lead = { id: "lead-1", fullName: "Jane Doe", company: "Acme", jobTitle: "VP Sales", pipelineState: "CONTACTED", enrichedData: null };
        const owner = { id: "member-1", userId: "user-1", role: "owner" };

        it("returns an honest zero without self-fetching when no event is in range", async () => {
            (prisma.calendarEvent.findFirst as any).mockResolvedValue(null);

            const result = await NurtureService.generateNurtureTasks("team-1", 7);

            expect(result).toEqual({ tasksCreated: 0 });
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(prisma.lead.findMany).not.toHaveBeenCalled();
        });

        it("creates a task for an eligible lead when the flow returns FOLLOW_UP", async () => {
            (prisma.calendarEvent.findFirst as any).mockResolvedValue(event);
            (prisma.lead.findMany as any).mockResolvedValue([lead]);
            (prisma.teamMember.findFirst as any).mockResolvedValue(owner);
            (calendarNurtureFlow.run as any).mockResolvedValue({ success: true, message: "Reach out now", nextAction: "FOLLOW_UP" });

            const result = await NurtureService.generateNurtureTasks("team-1", 7);

            expect(result).toEqual({ tasksCreated: 1 });
            expect(prisma.task.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    teamId: "team-1",
                    userId: "user-1",
                    leadId: "lead-1",
                    dueDate: event.eventDate,
                    description: "Reach out now",
                }),
            });
        });

        it("does not create a task when the flow says DROP or WAIT", async () => {
            (prisma.calendarEvent.findFirst as any).mockResolvedValue(event);
            (prisma.lead.findMany as any).mockResolvedValue([lead]);
            (prisma.teamMember.findFirst as any).mockResolvedValue(owner);
            (calendarNurtureFlow.run as any).mockResolvedValue({ success: true, message: "Not relevant", nextAction: "DROP" });

            const result = await NurtureService.generateNurtureTasks("team-1", 7);

            expect(result).toEqual({ tasksCreated: 0 });
            expect(prisma.task.create).not.toHaveBeenCalled();
        });

        it("returns zero when there is no eligible lead (idempotency filter excludes them all)", async () => {
            (prisma.calendarEvent.findFirst as any).mockResolvedValue(event);
            (prisma.lead.findMany as any).mockResolvedValue([]);

            const result = await NurtureService.generateNurtureTasks("team-1", 7);

            expect(result).toEqual({ tasksCreated: 0 });
            expect(calendarNurtureFlow.run).not.toHaveBeenCalled();
        });

        it("returns zero when the team has no assignable member", async () => {
            (prisma.calendarEvent.findFirst as any).mockResolvedValue(event);
            (prisma.lead.findMany as any).mockResolvedValue([lead]);
            (prisma.teamMember.findFirst as any).mockResolvedValue(null);

            const result = await NurtureService.generateNurtureTasks("team-1", 7);

            expect(result).toEqual({ tasksCreated: 0 });
            expect(calendarNurtureFlow.run).not.toHaveBeenCalled();
        });
    });
});
