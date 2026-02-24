
import { prisma } from "@/lib/db";
import { calendarNurtureFlow } from "@/lib/ai/flows/calendar_nurture_flow";
import { ApprovalService } from "@/modules/governance/ApprovalService";
import { OnPremAIProxy } from "@/lib/ai/OnPremAIProxy";
import { EventStore, SystemEventType } from "@/modules/learning/EventStore";
import { v4 as uuidv4 } from "uuid";

export class NurtureService {
    
    /**
     * Synchronizes the upcoming business events for the year
     */
    static async syncEvents(year: number = new Date().getFullYear() + 1) {
        console.log(`[NurtureService] Syncing events for year ${year}...`);
        try {
            const data = await calendarNurtureFlow(year);
            console.log(`[NurtureService] Successfully synced ${data.calendarEvents.length} events.`);
            return data;
        } catch (error) {
            console.error("[NurtureService] Failed to sync events:", error);
            throw error;
        }
    }

    /**
     * Identifies upcoming events and generates proactive outreach tasks
     * for relevant leads. This is the heart of the "Shadow Ingestion" pipeline.
     */
    static async generateNurtureTasks(teamId: string, daysForward: number = 7) {
        const horizon = new Date();
        horizon.setDate(horizon.getDate() + daysForward);

        // 1. Fetch upcoming events
        const upcomingEvents = await prisma.calendarEvent.findMany({
            where: {
                eventDate: {
                    gte: new Date(),
                    lte: horizon
                }
            },
            include: {
                newsletter: true
            }
        });

        console.log(`[NurtureService] Found ${upcomingEvents.length} events on the horizon.`);

        let taskCount = 0;

        for (const event of upcomingEvents) {
            if (!event.newsletter) continue;

            // 2. Find relevant leads for this event category
            // We map event category to lead tags (case-insensitive)
            const leads = await prisma.lead.findMany({
                where: {
                    teamId,
                    tags: {
                        hasSome: [event.category.toUpperCase(), event.category.toLowerCase(), event.category]
                    },
                    status: { not: "DNC" } // Don't nurture opted-out leads
                },
                take: 50 // Guardrail to prevent bulk spam
            });

            for (const lead of leads) {
                // 3. Prevent duplicate tasks for the same event-lead pair
                const existingTask = await prisma.approvalRequest.findFirst({
                    where: {
                        teamId,
                        entityId: lead.id,
                        actionType: "OUTREACH",
                        payload: {
                            path: ["eventContext", "eventId"],
                            equals: event.id
                        } as any
                    }
                });

                if (existingTask) continue;

                // 4. Generate Outreach Draft (with Local AI fallback)
                let draftContent = "";
                try {
                    // Try local node first for compliance/cost
                    draftContent = await OnPremAIProxy.generate(
                        `Draft a hyper-personalized outreach email for ${lead.fullName} at ${lead.company}. 
                        Context: Upcoming event "${event.eventName}" on ${event.eventDate.toDateString()}. 
                        Angle: ${event.leadGenAngle}. 
                        Template: ${event.newsletter.emailBodyHtml}`
                    );
                } catch (e) {
                    // System fallback to cloud provided template if on-prem is down
                    draftContent = event.newsletter.emailBodyHtml
                        .replace("[NAME]", lead.fullName || "there")
                        .replace("[COMPANY]", lead.company || "your team");
                }

                // 5. Enqueue in Governance Queue
                await ApprovalService.requestApproval(
                    lead.id, 
                    teamId, 
                    "OUTREACH", 
                    {
                        goal: `Proactive Nurture: ${event.eventName}`,
                        leadId: lead.id,
                        email: lead.email,
                        draft_content: draftContent,
                        eventContext: {
                            eventId: event.id,
                            eventName: event.eventName,
                            angle: event.leadGenAngle
                        }
                    },
                    "NURTURE_SERVICE"
                );

                taskCount++;
            }
        }

        // 6. Record completion event
        await EventStore.record({
            type: SystemEventType.SYSTEM,
            name: "NURTURE_TASKS_GENERATED",
            teamId,
            payload: { eventsProcessed: upcomingEvents.length, tasksCreated: taskCount }
        });

        return { tasksCreated: taskCount };
    }
}
