import { JobQueue } from "@/lib/queue";

export type SequenceStep = "VISIT" | "CONNECT" | "MESSAGE" | "EMAIL";

export class SequenceService {
    static async startSequence(leadId: string, profileUrl: string, teamId?: string) {
        console.log(`Starting sequence for lead ${leadId}`);
        // Step 1: Visit Profile immediately
        await this.scheduleStep(leadId, profileUrl, "VISIT", 0, teamId);
    }

    static async scheduleStep(leadId: string, profileUrl: string, step: SequenceStep, delaySeconds: number = 0, teamId?: string) {
        console.log(`Scheduling step ${step} for lead ${leadId} in ${delaySeconds}s`);

        await JobQueue.enqueue("SEQUENCE_ACTION", {
            leadId,
            url: profileUrl,
            action: step,
            ...(teamId ? { teamId } : {})
        }, { priority: 0, processAt: new Date(Date.now() + delaySeconds * 1000) });
    }

    static async scheduleNextStep(leadId: string, profileUrl: string, currentStep: SequenceStep, teamId?: string) {
        switch (currentStep) {
            case "VISIT":
                // Next: Connect (after 1 hour delay)
                await this.scheduleStep(leadId, profileUrl, "CONNECT", 3600, teamId);
                break;
            case "CONNECT":
                // Next: Message (follow up after 24 hours)
                await this.scheduleStep(leadId, profileUrl, "MESSAGE", 86400, teamId);
                break;
            case "MESSAGE":
                // Next: Email (if connected and replied? or just follow up)
                // Let's assume a hybrid flow: Visit -> Connect -> Message -> Email
                await this.scheduleStep(leadId, profileUrl, "EMAIL", 86400 * 2, teamId); // 2 days later
                break;
            case "EMAIL":
                console.log("Sequence finished");
                break;
        }
    }
}
