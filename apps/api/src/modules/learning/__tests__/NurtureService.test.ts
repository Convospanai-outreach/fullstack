import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        calendarEvent: {
            findMany: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
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
        it("returns an honest zero without self-fetching or touching prisma", async () => {
            const result = await NurtureService.generateNurtureTasks("team-1", 7);

            expect(result).toEqual({ tasksCreated: 0 });
            expect(fetchSpy).not.toHaveBeenCalled();
            expect(prisma.calendarEvent.findMany).not.toHaveBeenCalled();
        });
    });
});
