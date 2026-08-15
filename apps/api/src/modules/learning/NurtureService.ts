import { prisma } from "@/lib/db";

export class NurtureService {
    // Was self-fetching POST /nurture/sync-events, which doesn't exist as a route (a hard
    // 500 today, since the catch rethrows). "Syncing" here would mean pulling from an
    // external holiday calendar and generating brand newsletter copy per event, the way
    // apps/api/src/scripts/seed-events.ts does by hand for 2026 - that's content generation,
    // not something derivable from the schema, and isn't reusable as a general, parameterized
    // function (it's a one-off script with hardcoded 2026 dates and hand-written copy).
    // Replaced the self-fetch with a real read of whatever CalendarEvent rows already exist
    // for the requested year, mirroring the same prisma.calendarEvent.findMany pattern the
    // sibling GET handler in routes/nurture/trigger/route.ts already uses.
    //
    // Flagging: the default year is currentYear + 1 (unchanged from the original code), and
    // only 2026 has been seeded via seed-events.ts, so calling this with the default today
    // reports 0 events - that's real, not a bug introduced here.
    static async syncEvents(year: number = new Date().getFullYear() + 1) {
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year + 1, 0, 1));

        const calendarEvents = await prisma.calendarEvent.findMany({
            where: { eventDate: { gte: start, lt: end } },
            orderBy: { eventDate: "asc" }
        });

        return { calendarEvents };
    }

    // Was self-fetching POST /nurture/generate-tasks, which doesn't exist as a route.
    // NOT FIXED (computation, not just the fetch): generating real nurture tasks would mean
    // matching leads to upcoming calendar events and deciding a next action per lead - the
    // only related code in the repo, calendarNurtureFlow
    // (apps/api/src/lib/ai/flows/calendar_nurture_flow.ts), is itself an orphaned, zero-caller
    // AI flow that was never wired to any lead/event matching logic. There is no existing
    // computation to mirror here; inventing the matching rules and AI orchestration would mean
    // designing a new feature inside a self-fetch bug fix, not fixing one. Removed the broken
    // self-fetch and return the same honest zero the original catch-block fallback already
    // used, rather than fabricate a task-generation algorithm.
    static async generateNurtureTasks(_teamId: string, _daysForward: number = 7) {
        return { tasksCreated: 0 };
    }
}
