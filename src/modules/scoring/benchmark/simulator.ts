
export interface SimulationEvent {
    type: "PAGE_VIEW" | "CLICK" | "EMAIL_OPEN" | "REPLY";
    timestamp: Date;
    metadata?: any;
}

export class ScoringSimulator {

    /**
     * Generates a sequence of events simulating a high-intent user
     * @param leadId 
     * @param startTime 
     */
    generateHighIntentProfile(_leadId: string, startTime: Date): SimulationEvent[] {
        const events: SimulationEvent[] = [];
        let currentTime = new Date(startTime);

        // 1. Initial Discovery (Page View)
        events.push({ type: "PAGE_VIEW", timestamp: new Date(currentTime) });

        // 2. Deep Dive (30 mins later)
        currentTime = new Date(currentTime.getTime() + 30 * 60000);
        events.push({ type: "PAGE_VIEW", timestamp: new Date(currentTime), metadata: { page: "/pricing" } });

        // 3. Action (5 mins later)
        currentTime = new Date(currentTime.getTime() + 5 * 60000);
        events.push({ type: "CLICK", timestamp: new Date(currentTime), metadata: { element: "signup_button" } });

        return events;
    }

    /**
     * Generates a dormant user profile (sparse events)
     */
    generateDormantProfile(_leadId: string, startTime: Date): SimulationEvent[] {
        return [
            { type: "PAGE_VIEW", timestamp: startTime }
        ];
    }
}
