import { aiService } from "@/lib/aiService";

/**
 * Calendar Nurture Flow
 * Uses AI to determine the best follow-up action for a calendar event or lead.
 */
export const calendarNurtureFlow = {
    run: async (input: { leadContext: string; eventDetails: string; pastInteractions: string }) => {
        console.log("[Genkit] Running calendar nurture flow for input:", input);
        
        try {
            const prompt = `
                You are an expert sales development representative.
                Analyze the following lead and calendar event details and past interactions.
                Determine the absolute best next action to nurture this lead.
                
                Lead Context: ${input.leadContext}
                Event Details: ${input.eventDetails}
                Past Interactions: ${input.pastInteractions}
                
                Output JSON strictly matching this format:
                {
                    "success": true,
                    "message": "reasoning for the action",
                    "nextAction": "FOLLOW_UP" | "SEND_MATERIAL" | "WAIT" | "DROP"
                }
            `;
            
            const response = await aiService.askAI(prompt, undefined, { 
                taskType: "ANALYSIS", 
                expectsJson: true 
            });
            
            const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            
            return {
                success: true,
                message: parsed.message || "Calendar nurture flow executed successfully.",
                nextAction: parsed.nextAction || "FOLLOW_UP"
            };
        } catch (error: any) {
            console.error("[Genkit] Calendar nurture flow failed:", error.message);
            // Fallback for resiliency
            return {
                success: false,
                message: "AI analysis failed, defaulting to standard follow-up.",
                nextAction: "FOLLOW_UP"
            };
        }
    }
};
