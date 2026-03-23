import { mcpManager } from "@/lib/mcp/McpManager";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";
import { aiService } from "@/lib/aiService";
import { TOON } from "@/lib/ai/TOON";
import { netjanaServer } from "@/modules/integration/mcp/netjana-server";

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
     * Agentic Market Intelligence:
     * Pulls signals from Netjana and autonomously updates lead context.
     */
    static async syncMarketIntelligence(query: string, teamId: string) {
        console.log(`[BullsEye:Agentic] Syncing market intelligence for "${query}"...`);

        // 1. Fetch Ingress Signal from Netjana MCP
        const intentData = await netjanaServer.callTool("fetch_customer_intent", { query });

        // 2. Process each signal
        for (const signal of intentData.signals) {
            // Sterilize via TOON before logic processing
            const { optimizedPrompt: safeSignal } = await TOON.process(signal.signal, teamId);
            
            console.log(`[BullsEye] Processed safe signal for ${signal.company}: ${safeSignal}`);

            // Logic to update Lead or Campaign based on intent
            if (signal.confidence > 0.9) {
                await this.processSignal({
                    id: crypto.randomUUID(),
                    type: 'INTENT_DETECTED',
                    confidence: signal.confidence,
                    metadata: { ...signal, sterilizedSignal: safeSignal, teamId }
                });
            }
        }
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

                // Selectors should be moved to a configuration file or environment variables
                const CRM_TAB_SELECTOR = process.env['CRM_TAB_SELECTOR'] || "#crm-tab";
                const NOTE_FIELD_SELECTOR = process.env['NOTE_FIELD_SELECTOR'] || "#note-field";
                const SAVE_BUTTON_SELECTOR = process.env['SAVE_BUTTON_SELECTOR'] || "#save-button";

                // 1. "Click CRM Tab" (Using MCP)
                await mcpManager.callTool("computer_click", { selector: CRM_TAB_SELECTOR });

                // 2. Type the update note
                const note = `[Auto-Log] Detected high intent signal from Conversation ${signal.metadata['conversationId']}.`;
                await mcpManager.callTool("computer_type", { selector: NOTE_FIELD_SELECTOR, text: note });

                // 3. "Save Button"
                await mcpManager.callTool("computer_click", { selector: SAVE_BUTTON_SELECTOR });

                console.log("[BullsEye] CRM successfully updated via MCP Computer Use Server.");
            } catch (e: any) {
                console.error("[BullsEye] CRM update failed:", e.message);
            }
        }
    }
}
