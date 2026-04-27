import { mcpManager } from "@/lib/mcp/McpManager";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";
import { aiService } from "@/lib/aiService";
import { TOON } from "@/lib/ai/TOON";

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
            const result = await aiService.askAI(prompt, undefined, { 
                taskType: "ANALYSIS", 
                groundingContext: context, 
                expectsJson: true, 
                disableGuardrails: true 
            });

            // If the AI explicitly says NULL or returns an empty string, don't crash, but don't return a junk signal
            const cleanedResult = result.trim().replace(/```json/g, "").replace(/```/g, "");
            if (!cleanedResult || cleanedResult.toUpperCase() === "NULL") {
                console.log("[BullsEye] AI returned NULL or empty for signal detection.");
                return null;
            }

            let parsed;
            try {
                parsed = JSON.parse(cleanedResult);
            } catch (parseErr) {
                console.warn("[BullsEye] Failed to parse AI response as JSON:", cleanedResult);
                // Fallback: try to see if the type is mentioned in text
                if (cleanedResult.includes("INTENT_DETECTED")) parsed = { type: "INTENT_DETECTED", confidence: 0.5 };
                else if (cleanedResult.includes("MEETING_BOOKED")) parsed = { type: "MEETING_BOOKED", confidence: 0.5 };
                else return null;
            }

            if (parsed.confidence > 0.6) {
                return {
                    id: crypto.randomUUID(),
                    type: parsed.type,
                    confidence: parsed.confidence,
                    metadata: { 
                        conversationId, 
                        source: 'semantic_rag', 
                        detectedAt: new Date().toISOString(),
                        ...parsed 
                    }
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

        // 1. Fetch ingress signal through managed MCP path (classified low risk)
        await mcpManager.initialize();
        const intentData = await mcpManager.callTool(
            "fetch_customer_intent",
            { query },
            {
                teamId,
                source: "service",
                approved: true
            }
        );

        // 2. Process each signal
        for (const signal of intentData.signals || []) {
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

            // 2. High-risk MCP automation is disabled by default to avoid governance bypass.
            const allowAutonomousMcp = process.env["ENABLE_BULLSEYE_AUTONOMOUS_MCP"] === "true";
            const allowUnsafeBypass = process.env["ALLOW_UNSAFE_MCP_BYPASS"] === "true";
            if (!allowAutonomousMcp || !allowUnsafeBypass) {
                console.warn("[BullsEye] High-risk MCP automation skipped. Enable both ENABLE_BULLSEYE_AUTONOMOUS_MCP=true and ALLOW_UNSAFE_MCP_BYPASS=true only for controlled environments.");
                return;
            }

            // 3. Trigger Computer Use to update CRM
            try {
                await mcpManager.initialize();

                // Selectors should be moved to a configuration file or environment variables
                const CRM_TAB_SELECTOR = process.env['CRM_TAB_SELECTOR'] || "#crm-tab";
                const NOTE_FIELD_SELECTOR = process.env['NOTE_FIELD_SELECTOR'] || "#note-field";
                const SAVE_BUTTON_SELECTOR = process.env['SAVE_BUTTON_SELECTOR'] || "#save-button";
                const signalTeamId = typeof signal.metadata["teamId"] === "string" ? signal.metadata["teamId"] : undefined;

                // 1. "Click CRM Tab" (Using MCP)
                await mcpManager.callTool("computer_click", { selector: CRM_TAB_SELECTOR }, {
                    teamId: signalTeamId,
                    source: "service",
                    bypassGovernance: true
                });

                // 2. Type the update note
                const note = `[Auto-Log] Detected high intent signal from Conversation ${signal.metadata['conversationId']}.`;
                await mcpManager.callTool("computer_type", { selector: NOTE_FIELD_SELECTOR, text: note }, {
                    teamId: signalTeamId,
                    source: "service",
                    bypassGovernance: true
                });

                // 3. "Save Button"
                await mcpManager.callTool("computer_click", { selector: SAVE_BUTTON_SELECTOR }, {
                    teamId: signalTeamId,
                    source: "service",
                    bypassGovernance: true
                });

                console.log("[BullsEye] CRM successfully updated via MCP Computer Use Server.");
            } catch (e: any) {
                console.error("[BullsEye] CRM update failed:", e.message);
            }
        }
    }
}
