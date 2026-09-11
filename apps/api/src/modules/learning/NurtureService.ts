import { prisma } from "@/lib/db";
import { calendarNurtureFlow } from "@/lib/ai/flows/calendar_nurture_flow";

// Kept small since the caller (routes/nurture/trigger) is a synchronous,
// session-authed request making one sequential AI call per candidate lead.
const CANDIDATE_LEAD_LIMIT = 5;

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

    // Matches the team's active leads against the nearest upcoming calendar event and asks
    // calendarNurtureFlow (previously an orphaned, unwired AI flow) to decide a next action per
    // lead, creating a Task for anything that isn't DROP/WAIT. Bounded to one event and
    // CANDIDATE_LEAD_LIMIT leads per call since the caller (routes/nurture/trigger) is a
    // synchronous, session-authed request.
    static async generateNurtureTasks(teamId: string, daysForward: number = 7) {
        const start = new Date();
        const end = new Date(Date.now() + daysForward * 24 * 60 * 60 * 1000);

        const nextEvent = await prisma.calendarEvent.findFirst({
            where: { eventDate: { gte: start, lte: end } },
            orderBy: { eventDate: "asc" },
        });
        if (!nextEvent) {
            return { tasksCreated: 0 };
        }

        const candidateLeads = await prisma.lead.findMany({
            where: {
                teamId,
                pipelineState: { notIn: ["CLOSED_WON", "CLOSED_LOST"] },
                tasks: { none: { dueDate: nextEvent.eventDate } },
            },
            take: CANDIDATE_LEAD_LIMIT,
        });
        if (candidateLeads.length === 0) {
            return { tasksCreated: 0 };
        }

        const assignee = await prisma.teamMember.findFirst({
            where: { teamId, role: "owner", userId: { not: null } },
            orderBy: { createdAt: "asc" },
        }) ?? await prisma.teamMember.findFirst({
            where: { teamId, userId: { not: null } },
            orderBy: { createdAt: "asc" },
        });
        if (!assignee?.userId) {
            // No user to assign nurture tasks to for this team - nothing to create.
            return { tasksCreated: 0 };
        }

        const eventDetails = `${nextEvent.eventName} on ${nextEvent.eventDate.toDateString()} - ${nextEvent.leadGenAngle}`;

        let tasksCreated = 0;
        for (const lead of candidateLeads) {
            const leadContext = `${lead.fullName || "Unknown"} at ${lead.company || "unknown company"}, title: ${lead.jobTitle || "unknown"}, pipeline stage: ${lead.pipelineState}`;
            const pastInteractions = lead.enrichedData ? JSON.stringify(lead.enrichedData) : "No prior interaction data recorded.";

            const decision = await calendarNurtureFlow.run({ leadContext, eventDetails, pastInteractions, teamId });
            if (!decision.success || decision.nextAction === "DROP" || decision.nextAction === "WAIT") {
                continue;
            }

            await prisma.task.create({
                data: {
                    teamId,
                    userId: assignee.userId,
                    leadId: lead.id,
                    title: `${nextEvent.eventName}: ${decision.nextAction === "SEND_MATERIAL" ? "Send material" : "Follow up"} with ${lead.fullName || "lead"}`,
                    description: decision.message,
                    dueDate: nextEvent.eventDate,
                    priority: decision.nextAction === "SEND_MATERIAL" ? "MEDIUM" : "HIGH",
                },
            });
            tasksCreated += 1;
        }

        return { tasksCreated };
    }
}
