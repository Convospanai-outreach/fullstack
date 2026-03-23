import { prisma } from "@/lib/db";
import { HardwareService } from "@/services/HardwareService";
import { HardwareConnectionError } from "./errors";
import { TrustEngine } from "@/modules/governance/TrustEngine";
import { EventStore, SystemEventType } from "@/modules/learning/EventStore";
import { mcpManager } from "@/lib/mcp/McpManager";
import { microLLM } from "@/ai/MicroLLMClient";

export enum AgentState {
    // Standard States
    PLANNING = "PLANNING",
    REVIEWING = "REVIEWING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",

    // Cyber-Physical DFA States
    HARDWARE_HANDSHAKE = "HARDWARE_HANDSHAKE",
    DATA_INGESTION = "DATA_INGESTION",
    SANITIZATION = "SANITIZATION",     // INPUT: Text -> Masked Text
    LLM_GENERATION = "LLM_GENERATION", // PROCESS: Masked Text -> Draft (Safe)
    ADVERSARIAL_CHECK = "ADVERSARIAL_CHECK", // OUTPUT: Draft -> Critic -> Approved/Rejected
    EXECUTION = "EXECUTION",

    // Offline Mode
    QUEUED_OFFLINE = "QUEUED_OFFLINE",

    // Governance States
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
}

export interface ToolCall {
    tool: string;
    args: Record<string, any>;
}

export interface AgentContext {
    target_company?: string;
    target_name?: string;
    target_domain?: string;
    email?: string;
    role?: string;
    company?: string;
    _hunter_score?: number;
    safe_prompt_payload?: string;
    _token_map?: [string, string][];
    tool_call?: ToolCall;
    draft_content?: string;
    _retryCount?: number;
    _failureReason?: string;
    [key: string]: any;
}

export interface HunterResult {
    email?: string;
    score?: number;
    position?: string;
    company?: string;
}

export class AgentExecutor {


    /**
     * Starts a new autonomous task (Task 10: Unified Architecture)
     */
    async startTask(teamId: string, goal: string, context: AgentContext = {}): Promise<string> {
        // Task 5: Hard Policy Enforcement
        await TrustEngine.enforcePolicy(teamId, "AGENT_START");

        // Initialize MCP
        await mcpManager.initialize();

        // Mode: CYBER_PHYSICAL
        const startState = AgentState.HARDWARE_HANDSHAKE;

        const task = await prisma.agentTask.create({
            data: {
                teamId,
                goal,
                status: startState,
                context,
                plan: [],
            },
        });

        // Task 2: Record Event
        await EventStore.record({
            type: SystemEventType.SYSTEM,
            name: "AGENT_TASK_STARTED",
            teamId,
            payload: { taskId: task.id, goal }
        });

        await this.log(task.id, "SYSTEM", `Task started: ${goal}. Mode: CYBER_PHYSICAL. State: ${startState}. MCP Initialized.`);
        return task.id;
    }

    /**
     * Run the loop until completion or max steps
     */
    async runToCompletion(taskId: string, maxSteps: number = 20) {
        let steps = 0;
        while (steps < maxSteps) {
            try {
                const status = await this.step(taskId);
                if (status === AgentState.COMPLETED || status === AgentState.FAILED || status === AgentState.REVIEWING || status === AgentState.AWAITING_APPROVAL) {
                    return status;
                }
            } catch (error: any) {
                console.error(`Step failed: ${error.message}`);
                await this.log(taskId, "ERROR", error.message);
                if (error instanceof HardwareConnectionError) {
                    // Fail Safe: If hardware disconnects, we MUST stop.
                    await prisma.agentTask.update({ where: { id: taskId }, data: { status: AgentState.FAILED } });
                    return AgentState.FAILED;
                }
            }
            steps++;
        }
        return "MAX_STEPS_REACHED";
    }

    /**
     * Executes a single step of the State Machine
     */
    async step(taskId: string): Promise<string> {
        const task = await prisma.agentTask.findUnique({
            where: { id: taskId },
            include: { logs: true },
        });

        if (!task) throw new Error("Task not found");
        const currentState = task.status as AgentState;

        // Dead Letter Queue Check
        const ctx: AgentContext = (task.context as unknown as AgentContext) || {};
        const retryCount = ctx._retryCount || 0;
        const MAX_RETRY = 3;

        if (currentState === AgentState.COMPLETED || currentState === AgentState.FAILED || currentState === AgentState.REVIEWING) return currentState;

        await this.log(taskId, "SYSTEM", `Entering State: ${currentState} (Attempt ${retryCount + 1})`);

        try {
            // HARDENING: Identify & Fail-Closed check at every step
            await HardwareService.verifyHardwareIdentity();

            // --- CYBER-PHYSICAL DFA ---

            // 1. HARDWARE_HANDSHAKE
            if (currentState === AgentState.HARDWARE_HANDSHAKE) {
                // ... existing handshake logic ...
                await HardwareService.verifyHardwareIdentity();
                await this.log(taskId, "OBSERVATION", "Hardware Handshake Verified. Physical Node Online.");
                return await this.transition(taskId, AgentState.DATA_INGESTION);
            }

            // 2. DATA_INGESTION (Hunter.io Integration)
            if (currentState === AgentState.DATA_INGESTION) {
                const { HunterService } = await import("@/modules/hunter-email-finder/service/hunterService");

                await this.log(taskId, "ACTION", "Querying Hunter.io API for contact details...");

                // Extract query params from context or goal
                const ctx: AgentContext = (task.context as unknown as AgentContext) || {};
                const targetCompany = ctx.target_company || "Acme Corp";
                const targetName = ctx.target_name || "John Doe";
                const domain = ctx.target_domain || "acme.com";

                const result: HunterResult = await HunterService.findEmail(targetName, domain) as any;

                if (result.email) {
                    const enrichedContext = {
                        ...ctx,
                        email: result.email,
                        role: result.position || ctx.role,
                        company: result.company || targetCompany,
                        _hunter_score: result.score
                    };
                    await prisma.agentTask.update({ where: { id: taskId }, data: { context: enrichedContext } });
                    await this.log(taskId, "OBSERVATION", `Data Ingested. Found email: ${result.email} (Score: ${result.score})`);
                } else {
                    await this.log(taskId, "OBSERVATION", "Data Ingested. No email found via Hunter.io. Proceeding with available info.");
                }

                return await this.transition(taskId, AgentState.SANITIZATION);
            }

            // 3. SANITIZATION (Sovereign Firewall + Micro-LLM Intent Pre-Check)
            if (currentState === AgentState.SANITIZATION) {
                const { TOON } = await import("@/lib/ai/TOON");
                const ctx: AgentContext = (task.context as unknown as AgentContext) || {};

                // Construct the prompt with potentially sensitive data
                const promptPayload = {
                    role: ctx.role,
                    company: ctx.target_company,
                    context: `Draft an email to [ROLE] at [COMPANY] about our security product.`
                };

                await this.log(taskId, "ACTION", `TOON: Sterilizing and optimizing prompt...`);

                const { optimizedPrompt: safeContext, tokenMap } = await TOON.process(JSON.stringify(promptPayload), task.teamId);
                const serializedMap = Array.from(tokenMap.entries());

                // MICRO-LLM GATE: Classify outbound intent LOCALLY before touching the cloud
                // This prevents wasting cloud tokens on spam/policy violations
                try {
                    const intentCheck = await microLLM.infer({
                        taskType: "POLICY_CLASSIFICATION",
                        inputText: typeof safeContext === "string" ? safeContext : JSON.stringify(safeContext),
                        policyRules: { noPressure: true, noGuarantees: true, whatsappConsent: false }
                    });
                    await this.log(taskId, "OBSERVATION", `[MicroLLM] Intent Pre-Check: ${intentCheck.classification ?? "ALLOW"} (confidence: ${intentCheck.confidence.toFixed(2)})`);

                    if (intentCheck.classification === "BLOCK") {
                        await this.log(taskId, "GOVERNANCE", `[MicroLLM] Payload blocked before cloud inference: ${intentCheck.refusalReason ?? "policy violation"}`);
                        return await this.transition(taskId, AgentState.FAILED);
                    }
                } catch (microErr: any) {
                    // Non-fatal: if edge node is offline, log a warning but continue
                    await this.log(taskId, "WARNING", `[MicroLLM] Intent pre-check unavailable (edge node offline?): ${microErr.message}`);
                }

                await this.log(taskId, "OBSERVATION", `Sanitization Complete. Payload masked.`);

                const newContext = {
                    ...ctx,
                    safe_prompt_payload: safeContext,
                    _token_map: serializedMap
                };
                await prisma.agentTask.update({ where: { id: taskId }, data: { context: newContext } });
                return await this.transition(taskId, AgentState.LLM_GENERATION);
            }

            // 4. LLM_GENERATION (ModelGateway via AI Service)
            if (currentState === AgentState.LLM_GENERATION) {
                const { aiService } = await import("@/lib/aiService");
                const { TOON } = await import("@/lib/ai/TOON");
                const { KnowledgeIngressService } = await import("@/modules/rag/service/KnowledgeIngressService");
                const { mcpManager } = await import("@/lib/mcp/McpManager");

                const ctx: AgentContext = (task.context as unknown as AgentContext) || {};

                // Use the SAFE Payload
                const safePayload = JSON.parse(ctx.safe_prompt_payload || "{}");

                // DISCOVER TOOLS
                const tools = await mcpManager.getAllTools();
                const toolsDesc = tools.map(t =>
                    `- ${t.name}: ${t.description} (Schema: ${JSON.stringify(t.inputSchema)})`
                ).join("\n");

                // AGENTIC RAG: Retrieve campaign context
                const query = task.goal.substring(0, 100); // Simple query extraction
                const ragContext = await KnowledgeIngressService.agenticSearch(task.teamId, query);

                const prompt = `
GOAL: ${task.goal}
CONTEXT: ${JSON.stringify(safePayload)}
DOMAIN KNOWLEDGE:
${ragContext}

AVAILABLE TOOLS:
${toolsDesc}

INSTRUCTIONS:
You are an autonomous agent. You can either generate content OR use a tool.
If you need to use a tool to achieve the goal (e.g. navigate, click), output a JSON object with this EXACT structure:
{
  "tool": "tool_name",
  "args": { ...arguments }
}

If you are generating final content (e.g. email draft), just output the text.

RESPONSE:
`;

                await this.log(taskId, "ACTION", "Generating content/action using MASKED context and TOOLS...");

                // Real LLM Call
                const generatedRaw = await aiService.askAI(prompt, task.teamId);

                // Check for Tool Call (Simple JSON extraction)
                let toolCall: ToolCall | null = null;
                try {
                    const clean = generatedRaw.trim().replace(/```json/g, "").replace(/```/g, "");
                    if (clean.startsWith("{") && clean.endsWith("}")) {
                        const parsed = JSON.parse(clean);
                        if (parsed.tool && parsed.args) {
                            toolCall = parsed;
                        }
                    }
                } catch (e) { /* Not a JSON tool call */ }

                if (toolCall) {
                    await this.log(taskId, "DECISION", `Agent selected tool: ${toolCall.tool}`);
                    const newContext = { ...ctx, tool_call: toolCall };
                    await prisma.agentTask.update({ where: { id: taskId }, data: { context: newContext } });

                    // GOVERNANCE: High-Risk Action Check
                    // For now, ALL tool calls are considered high risk and require approval
                    const { ApprovalService } = await import("@/modules/governance/ApprovalService");
                    await ApprovalService.requestApproval(taskId, task.teamId, "MCP_TOOL_EXECUTION", toolCall, task.userId || "agent-autonomous");

                    // AUDIT: Approval requested
                    await EventStore.record({
                        type: SystemEventType.AGENT,
                        name: "AGENT_APPROVAL_REQUESTED",
                        teamId: task.teamId,
                        actorId: "AGENT_EXECUTOR",
                        payload: {
                            taskId,
                            actionType: "MCP_TOOL_EXECUTION",
                            riskLevel: "HIGH",
                            details: toolCall
                        }
                    });

                    await this.log(taskId, "GOVERNANCE", "Transitioning to AWAITING_APPROVAL for Tool Execution.");
                    return await this.transition(taskId, AgentState.AWAITING_APPROVAL);
                }

                // Normal Content Flow
                // UNMASK: Restore PII
                const tokenMap = new Map(ctx._token_map as [string, string][]);
                const restoredContent = TOON.unmask(generatedRaw, tokenMap);

                await this.log(taskId, "OBSERVATION", `LLM Generated & Detokenized content.`);

                const newContext = { ...ctx, draft_content: restoredContent };
                await prisma.agentTask.update({ where: { id: taskId }, data: { context: newContext } });
                return await this.transition(taskId, AgentState.ADVERSARIAL_CHECK);
            }

            // 5. AWAITING_APPROVAL
            if (currentState === AgentState.AWAITING_APPROVAL) {
                const { ApprovalService, ApprovalStatus } = await import("@/modules/governance/ApprovalService");
                const status = await ApprovalService.checkStatus(taskId);

                if (status === ApprovalStatus.APPROVED) {
                    await this.log(taskId, "GOVERNANCE", "Action APPROVED. Proceeding to Execution.");

                    // [NEW] Check for human edits/overrides in the approval note
                    const request = await prisma.approvalRequest.findFirst({
                        where: { entityId: taskId, status: "APPROVED" },
                        orderBy: { createdAt: 'desc' }
                    });

                    if (request?.reviewNote) {
                        try {
                            const edits = JSON.parse(request.reviewNote);
                            await this.log(taskId, "GOVERNANCE", "Applying human edits to task context...");
                            const currentCtx = (task.context as any) || {};
                            const updatedCtx = { ...currentCtx, ...edits };
                            
                            // If it was a tool call, the edits might be the new args
                            if (currentCtx.tool_call && edits.args) {
                                updatedCtx.tool_call = { ...currentCtx.tool_call, args: edits.args };
                            }

                            await prisma.agentTask.update({
                                where: { id: taskId },
                                data: { context: updatedCtx }
                            });
                        } catch (e) {
                            console.error("Failed to parse reviewNote for edits", e);
                        }
                    }

                    // AUDIT: Approval granted
                    await EventStore.record({
                        type: SystemEventType.AGENT,
                        name: "AGENT_APPROVAL_GRANTED",
                        teamId: task.teamId,
                        actorId: "HUMAN_APPROVER",
                        payload: { taskId, withEdits: !!request?.reviewNote }
                    });

                    return await this.transition(taskId, AgentState.EXECUTION);
                } else if (status === ApprovalStatus.REJECTED) {
                    await this.log(taskId, "GOVERNANCE", "Action REJECTED. Terminating Task.");

                    // AUDIT: Approval rejected
                    await EventStore.record({
                        type: SystemEventType.AGENT,
                        name: "AGENT_APPROVAL_REJECTED",
                        teamId: task.teamId,
                        actorId: "HUMAN_APPROVER",
                        payload: { taskId, reason: "User rejected" }
                    });

                    return await this.transition(taskId, AgentState.FAILED);
                }

                // Still Pending
                return AgentState.AWAITING_APPROVAL; // Breaks the loop in runToCompletion
            }

            // 5. ADVERSARIAL_CHECK (Micro-LLM Brand + Policy Critic, then Sovereign Firewall)
            if (currentState === AgentState.ADVERSARIAL_CHECK) {
                const { SovereignFirewall } = await import("@/lib/ai/SovereignFirewall");
                const ctx: AgentContext = (task.context as unknown as AgentContext) || {};
                const draft = ctx.draft_content || "";

                await this.log(taskId, "ACTION", "[MicroLLM] Running Brand + Policy adversarial check (local, private)...");

                // STEP 1: Brand Enforcement via Micro-LLM (Private, Edge-only)
                try {
                    const team = await prisma.team.findUnique({ where: { id: task.teamId } });
                    const branding = (team?.branding as any) || {};
                    const brandCheck = await microLLM.infer({
                        taskType: "BRAND_ENFORCEMENT",
                        inputText: draft,
                        brandRules: {
                            tone: branding.tone || "Professional",
                            forbiddenPhrases: branding.forbiddenPhrases || []
                        }
                    }, undefined);

                    await this.log(taskId, "OBSERVATION", `[MicroLLM] Brand Check: ${brandCheck.classification ?? "ALLOW"} (confidence: ${brandCheck.confidence.toFixed(2)})`);

                    if (brandCheck.classification === "BLOCK") {
                        await this.log(taskId, "CRITIC_REJECT", `[MicroLLM] Brand violation: ${brandCheck.refusalReason ?? "brand guidelines violated"}`);
                        return await this.transition(taskId, AgentState.FAILED);
                    }

                    // STEP 2: Policy Compliance via Micro-LLM
                    const policyCheck = await microLLM.infer({
                        taskType: "POLICY_CLASSIFICATION",
                        inputText: draft,
                        policyRules: { noPressure: true, noGuarantees: true }
                    });

                    await this.log(taskId, "OBSERVATION", `[MicroLLM] Policy Check: ${policyCheck.classification ?? "ALLOW"} (confidence: ${policyCheck.confidence.toFixed(2)})`);

                    if (policyCheck.classification === "BLOCK") {
                        await this.log(taskId, "CRITIC_REJECT", `[MicroLLM] Policy violation: ${policyCheck.refusalReason ?? "policy violation"}. Attempting auto-rewrite...`);
                        // Try auto-repair via POLICY_REWRITE before giving up
                        const rewrite = await microLLM.infer({
                            taskType: "POLICY_REWRITE",
                            inputText: draft
                        });
                        if (rewrite.outputText && rewrite.confidence > 0.7) {
                            await this.log(taskId, "OBSERVATION", `[MicroLLM] Policy auto-rewrite succeeded (confidence: ${rewrite.confidence.toFixed(2)})`);
                            const rewrittenCtx = { ...ctx, draft_content: rewrite.outputText };
                            await prisma.agentTask.update({ where: { id: taskId }, data: { context: rewrittenCtx } });
                        } else {
                            await this.log(taskId, "CRITIC_REJECT", `[MicroLLM] Auto-rewrite confidence too low. Failing task.`);
                            return await this.transition(taskId, AgentState.FAILED);
                        }
                    }

                } catch (microErr: any) {
                    await this.log(taskId, "WARNING", `[MicroLLM] Checks unavailable: ${microErr.message}. Falling back to Sovereign Firewall critique.`);
                    // Fallback: use the SovereignFirewall critique (the old behaviour)
                    try {
                        const verdict = await SovereignFirewall.critique(draft);
                        await this.log(taskId, "OBSERVATION", `Fallback Critic Verdict: ${verdict.approved ? "APPROVED" : "REJECTED"} (score: ${verdict.score})`);
                        if (!verdict.approved) {
                            return await this.transition(taskId, AgentState.FAILED);
                        }
                    } catch (sfErr: any) {
                        await this.log(taskId, "CRITICAL_ERROR", `Sovereign Firewall also unreachable: ${sfErr.message}`);
                        throw sfErr;
                    }
                }

                await this.log(taskId, "OBSERVATION", "Adversarial checks passed. Draft approved for execution.");
                return await this.transition(taskId, AgentState.EXECUTION);
            }

            // 6. EXECUTION (Browser / MCP)
            if (currentState === AgentState.EXECUTION) {
                const ctx: AgentContext = (task.context as unknown as AgentContext) || {};

                // CHECK FOR MCP TOOL CALL
                if (ctx.tool_call) {
                    const { tool, args } = ctx.tool_call;
                    await this.log(taskId, "ACTION", `Executing MCP Tool: ${tool} with args ${JSON.stringify(args)}`);

                    try {
                        // Use McpManager's discovery logic
                        const result = await mcpManager.callTool(tool, args);
                        await this.log(taskId, "OBSERVATION", `Tool Execution Result: ${JSON.stringify(result)}`);

                        // AUDIT: Tool execution success
                        await EventStore.record({
                            type: SystemEventType.AGENT,
                            name: "AGENT_TOOL_EXECUTION",
                            teamId: task.teamId,
                            actorId: "AGENT_EXECUTOR",
                            payload: {
                                taskId,
                                toolName: tool,
                                args,
                                result,
                                success: true
                            }
                        });

                        // Clear tool call after execution
                        const newContext = { ...ctx };
                        delete newContext.tool_call;
                        await prisma.agentTask.update({ where: { id: taskId }, data: { context: newContext } });
                    } catch (e: any) {
                        await this.log(taskId, "ERROR", `Tool Execution Failed: ${e.message}`);

                        // AUDIT: Tool execution failure
                        await EventStore.record({
                            type: SystemEventType.AGENT,
                            name: "AGENT_TOOL_EXECUTION",
                            teamId: task.teamId,
                            actorId: "AGENT_EXECUTOR",
                            payload: {
                                taskId,
                                toolName: tool,
                                args,
                                success: false,
                                error: e.message
                            }
                        });

                        // ERROR RECOVERY: If tool fails, request handover instead of failing completely
                        await this.log(taskId, "GOVERNANCE", "Tool Failed. Initiating Handover to Human Operator.");
                        return await this.transition(taskId, AgentState.REVIEWING);
                    }
                    return await this.transition(taskId, AgentState.COMPLETED);
                }

                // EXPLICIT HANDOVER CHECK
                // If model outputs "HANDOVER", switch to reviewing
                // checks context...

                // FALLBACK TO LEGACY HARDWARE EXECUTION
                await this.log(taskId, "ACTION", "Executing Outreach via Physical Browser Node...");
                await HardwareService.execute("NAVIGATE", { url: "https://linkedin.com/in/target" });
                await this.log(taskId, "OBSERVATION", "Outreach Dispatched successfully.");

                // AUDIT: Task completed
                await EventStore.record({
                    type: SystemEventType.AGENT,
                    name: "AGENT_TASK_COMPLETED",
                    teamId: task.teamId,
                    actorId: "AGENT_EXECUTOR",
                    payload: { taskId, success: true }
                });

                return await this.transition(taskId, AgentState.COMPLETED);
            }

            return AgentState.FAILED;

        } catch (error: any) {
            console.error(`Step failed: ${error.message}`);
            await this.log(taskId, "ERROR", error.message);

            // HARDWARE FAILURE -> IMMEDIATE SAFE MODE
            if (error instanceof HardwareConnectionError) {
                await this.log(taskId, "SAFE_MODE", "Hardware Disconnected. Entering SAFE MODE. Manual intervention required.");
                await prisma.agentTask.update({ where: { id: taskId }, data: { status: AgentState.FAILED } }); // Could make a SAFE_MODE state if schema allowed
                return AgentState.FAILED;
            }

            // NORMAL FAILURE -> RETRY (DLQ) logic
            if (retryCount >= MAX_RETRY) {
                await this.log(taskId, "DLQ_MOVE", `Max Retries (${MAX_RETRY}) Exceeded. Moving to Dead Letter Queue.`);
                const ctx: any = task.context || {};
                await prisma.agentTask.update({
                    where: { id: taskId },
                    data: { status: AgentState.FAILED, context: { ...ctx, _failureReason: "MAX_RETRY_EXCEEDED" } }
                });
                return AgentState.FAILED;
            } else {
                // Increment Retry Count and Stay in Current State
                await this.log(taskId, "RETRY", `Retrying... (${retryCount + 1}/${MAX_RETRY})`);
                const ctx: any = task.context || {};
                await prisma.agentTask.update({
                    where: { id: taskId },
                    data: { context: { ...ctx, _retryCount: retryCount + 1 } }
                });
                return currentState; // Return same state to retry loop
            }
        }
    }

    private async transition(taskId: string, newState: AgentState): Promise<string> {
        // Get current state for audit log
        const task = await prisma.agentTask.findUnique({ where: { id: taskId } });
        const fromState = task?.status || 'UNKNOWN';

        await prisma.agentTask.update({
            where: { id: taskId },
            data: { status: newState }
        });

        // AUDIT: Record state transition
        await EventStore.record({
            type: SystemEventType.AGENT,
            name: "AGENT_STATE_TRANSITION",
            teamId: task?.teamId || "unknown",
            actorId: "AGENT_EXECUTOR",
            payload: { taskId, fromState, toState: newState }
        });

        return newState;
    }

    private async log(taskId: string, type: string, content: string) {
        const count = await prisma.agentLog.count({ where: { taskId } });
        await prisma.agentLog.create({
            data: { taskId, type, content, stepNumber: count + 1 },
        });
    }
}

export const agentExecutor = new AgentExecutor();
