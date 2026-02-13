import { mcpManager } from "@/lib/mcp/McpManager";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";

export interface Signal {
    id: string;
    type: 'INTENT_DETECTED' | 'DEAL_CLOSED' | 'MEETING_BOOKED' | 'CONCERN_RAISED';
    confidence: number;
    metadata: Record<string, any>;
}

export class BullsEyeRAG {
    /**
     * Detects high-value signals from the RAG context/conversation stream.
     * Uses semantic analysis via AI Service.
     */
    static async detectSignal(conversationId: string, context: string): Promise<Signal | null> {
        const prompt = `
            Analyze the following conversation context and determine if any high-value sales signals are present.
            Signals:
            - INTENT_DETECTED: Lead expresses explicit interest, asks about pricing, or mentions a pain point we solve.
            - DEAL_CLOSED: Lead agrees to a purchase or contract.
            - MEETING_BOOKED: Lead agrees to a specific time for a call/demo.
            - CONCERN_RAISED: Lead mentions a specific blocker or competitor.

            CONTEXT:
            "${context}"

            RESPONSE FORMAT (JSON ONLY, OR "NULL"):
            {
                "type": "SIGNAL_TYPE",
                "confidence": 0.0-1.0,
                "reason": "..."
            }
        `;

        try {
            const result = await aiService.askAI(prompt, undefined, { taskType: "ANALYSIS" });
            if (result.trim().toUpperCase() === "NULL") return null;

            const parsed = JSON.parse(result.trim().replace(/```json/g, "").replace(/```/g, ""));
            
            if (parsed.confidence > 0.7) {
                return {
                    id: crypto.randomUUID(),
                    type: parsed.type,
                    confidence: parsed.confidence,
                    metadata: { conversationId, source: 'semantic_rag', ...parsed }
                };
            }
        } catch (e) {
            console.error("[BullsEye] Semantic analysis failed:", e);
        }

        return null;
    }

    /**
     * "Cowork" Flow:
     * When a signal is detected, autonomously update the CRM using Computer Use.
     */
    static async processSignal(signal: Signal) {
        console.log(`[BullsEye] Processing Signal: ${signal.type} (${signal.confidence})`);

        if (signal.confidence > 0.85) {
            console.log("[BullsEye] High confidence signal. Triggering Cowork Agent...");

            // 1. Safety Check via Firewall (simulate PII check on the signal metadata)
            const isSafe = await SovereignFirewall.evaluate(JSON.stringify(signal.metadata));
            if (!isSafe) {
                console.warn("[BullsEye] Signal blocked by Sovereign Firewall.");
                return;
            }

            // 2. Trigger Computer Use to update CRM
            try {
                // Ensure MCP is initialized
                await mcpManager.initialize();

                // 1. "Click CRM Tab" (Using MCP)
                // In a real scenario, we'd have a specific tool for this or use navigate
                // For logic parity with the legacy mock:
                await mcpManager.callTool("computer_click", { selector: "#crm-tab" });

                // 2. Type the update note
                const note = `[Auto-Log] Detected high intent signal from Conversation ${signal.metadata['conversationId']}.`;
                await mcpManager.callTool("computer_type", { selector: "#note-field", text: note });

                // 3. "Save Button"
                await mcpManager.callTool("computer_click", { selector: "#save-button" });

                console.log("[BullsEye] CRM successfully updated via MCP Computer Use Server.");
            } catch (e: any) {
                console.error("[BullsEye] CRM update failed:", e.message);
            }
        }
    }
}
