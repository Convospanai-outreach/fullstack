import { prisma } from "@/lib/db";
import { HardwareService } from "@/services/HardwareService";
import { HardwareConnectionError } from "./errors";
import { TrustEngine } from "@/modules/governance/TrustEngine";
import { EventStore, SystemEventType } from "@/modules/learning/EventStore";

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
    QUEUED_OFFLINE = "QUEUED_OFFLINE"
}

export class AgentExecutor {
    /**
     * Starts a new autonomous task (Task 10: Unified Architecture)
     */
    async startTask(teamId: string, goal: string, context: any = {}): Promise<string> {
        // Task 5: Hard Policy Enforcement
        await TrustEngine.enforcePolicy(teamId, "AGENT_START");

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

        await this.log(task.id, "SYSTEM", `Task started: ${goal}. Mode: CYBER_PHYSICAL. State: ${startState}`);
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
                if (status === AgentState.COMPLETED || status === AgentState.FAILED || status === AgentState.REVIEWING) {
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
        const ctx: any = task.context || {};
        const retryCount = ctx._retryCount || 0;
        const MAX_RETRY = 3;

        if (currentState === AgentState.COMPLETED || currentState === AgentState.FAILED || currentState === AgentState.REVIEWING) return currentState;

        await this.log(taskId, "SYSTEM", `Entering State: ${currentState} (Attempt ${retryCount + 1})`);

        try {
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
                const ctx: any = task.context || {};
                const targetCompany = ctx.target_company || "Acme Corp";
                const targetName = ctx.target_name || "John Doe";
                const domain = ctx.target_domain || "acme.com";

                const result = await HunterService.findEmail(targetName, domain);

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

            // 3. SANITIZATION (Edge Node Service)
            if (currentState === AgentState.SANITIZATION) {
                const ctx: any = task.context || {};
                const promptText = `Draft an email to ${ctx.role} at ${ctx.target_company} about our security product.`;
                await this.log(taskId, "ACTION", `Sending prompt to Edge Node for Sanitization...`);

                const { sanitized_text, token_map_id, metadata_tags } = await HardwareService.sanitize(promptText);
                await this.log(taskId, "OBSERVATION", `Sanitization Complete.`);

                let enhanced_prompt = sanitized_text;
                if (metadata_tags) {
                    Object.entries(metadata_tags).forEach(([token, tag]) => {
                        enhanced_prompt = enhanced_prompt.replace(token, tag as string);
                    });
                }

                const newContext = {
                    ...ctx,
                    sanitized_prompt: enhanced_prompt,
                    raw_sanitized: sanitized_text,
                    token_map_id
                };
                await prisma.agentTask.update({ where: { id: taskId }, data: { context: newContext } });
                return await this.transition(taskId, AgentState.LLM_GENERATION);
            }

            // 4. LLM_GENERATION (ModelGateway via AI Service)
            if (currentState === AgentState.LLM_GENERATION) {
                const { aiService } = await import("@/lib/aiService");
                const ctx: any = task.context || {};
                const sanitizedPrompt = ctx.sanitized_prompt || ctx.goal; // Fallback if sanitization skipped

                await this.log(taskId, "ACTION", "Generating content using sanitized prompt...");

                // Real LLM Call using our new Architecture
                const generatedContent = await aiService.askAI(sanitizedPrompt, task.teamId);

                await this.log(taskId, "OBSERVATION", `LLM Generated Content (${generatedContent.length} chars).`);

                const newContext = { ...ctx, draft_content: generatedContent };
                await prisma.agentTask.update({ where: { id: taskId }, data: { context: newContext } });
                return await this.transition(taskId, AgentState.ADVERSARIAL_CHECK);
            }

            // 5. ADVERSARIAL_CHECK (Edge Node Critic)
            if (currentState === AgentState.ADVERSARIAL_CHECK) {
                const ctx: any = task.context || {};
                const draft = ctx.draft_content;
                await this.log(taskId, "ACTION", "Submitting draft to Sovereign Adversary/Critic...");

                const { status, similarity_score, reason } = await HardwareService.critique(draft);
                await this.log(taskId, "OBSERVATION", `Critic Verdict: ${status}. Reason: ${reason} (Score: ${similarity_score})`);

                if (status === 'REJECTED') {
                    await this.log(taskId, "CRITIC_REJECT", "Draft rejected by Sovereign Policy.");
                    return await this.transition(taskId, AgentState.REVIEWING);
                }
                return await this.transition(taskId, AgentState.EXECUTION);
            }

            // 6. EXECUTION (Browser)
            if (currentState === AgentState.EXECUTION) {
                await this.log(taskId, "ACTION", "Executing Outreach via Physical Browser Node...");
                await HardwareService.execute("NAVIGATE", { url: "https://linkedin.com/in/target" });
                await this.log(taskId, "OBSERVATION", "Outreach Dispatched successfully.");
                await EventStore.record({
                    type: SystemEventType.SYSTEM,
                    name: "AGENT_TASK_COMPLETED",
                    teamId: task.teamId,
                    payload: { taskId }
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
        await prisma.agentTask.update({
            where: { id: taskId },
            data: { status: newState }
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

