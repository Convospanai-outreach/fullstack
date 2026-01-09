
import { randomUUID } from "crypto";

export interface SimulationEvent {
    leadId: string;
    type: string;
    timestamp: Date;
    metadata?: any;
}

export class ScoringSimulator {

    /**
     * Generates a sequence of events simulating a "High Intent" user
     * who bursts into activity rapidly.
     */
    generateHighIntentProfile(leadId: string, startTime: Date): SimulationEvent[] {
        const events: SimulationEvent[] = [];
        let currentTime = new Date(startTime);

        // Initial Discovery
        events.push({ leadId, type: "PAGE_VIEW", timestamp: new Date(currentTime), metadata: { url: "/blog" } });

        // 2 hours later - Deep Dive (Burst of activity)
        currentTime = new Date(currentTime.getTime() + 2 * 60 * 60 * 1000);
        events.push({ leadId, type: "PAGE_VIEW", timestamp: new Date(currentTime), metadata: { url: "/pricing" } });

        // 5 mins later
        currentTime = new Date(currentTime.getTime() + 5 * 60 * 1000);
        events.push({ leadId, type: "PAGE_VIEW", timestamp: new Date(currentTime), metadata: { url: "/case-studies" } });

        // 2 mins later
        currentTime = new Date(currentTime.getTime() + 2 * 60 * 1000);
        events.push({ leadId, type: "CLICK", timestamp: new Date(currentTime), metadata: { element: "book-demo" } });

        return events;
    }

    /**
     * Generates a "Dripping" profile (Low Intent/Browser)
     */
    generateBrowserProfile(leadId: string, startTime: Date): SimulationEvent[] {
        const events: SimulationEvent[] = [];
        let currentTime = new Date(startTime);

        // Visit once a day for 3 days
        for (let i = 0; i < 3; i++) {
            events.push({ leadId, type: "PAGE_VIEW", timestamp: new Date(currentTime), metadata: { url: "/blog" } });
            currentTime = new Date(currentTime.getTime() + 24 * 60 * 60 * 1000);
        }
        return events;
    }
}
