
import { prisma } from "@/lib/db";
import { toolRegistry } from "./ToolRegistry";
import { modelGateway, TaskComplexity } from "@/ai/ModelGateway";
import { sovereignFirewall } from "@/ai/SovereignFirewall";
import { ApprovalService } from "@/modules/governance/service/approvalService";

// Temporary cast to allow build before migration runs
const db = prisma as any;

enum AgentState {
    PLANNING = "PLANNING",
    EXECUTING = "EXECUTING",
    REVIEWING = "REVIEWING",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED"
}

export class AgentExecutor {

    /**
     * Starts a new autonomous task
     */
    async startTask(teamId: string, goal: string, context: any = {}): Promise<string> {
        const task = await db.agentTask.create({
            data: {
                teamId,
                goal,
                status: AgentState.PLANNING, // Always start in Planning
                context,
                plan: [],
            },
        });

        await this.log(task.id, "SYSTEM", `Task started: ${goal}. State: PLANNING`);
        return task.id;
    }

    /**
     * Run the loop until completion or max steps
     */
    async runToCompletion(taskId: string, maxSteps: number = 10) {
        let steps = 0;
        while (steps < maxSteps) {
            const status = await this.step(taskId);
            if (status === AgentState.COMPLETED || status === AgentState.FAILED || status === AgentState.REVIEWING) {
                return status;
            }
            steps++;
        }
        return "MAX_STEPS_REACHED";
    }

    /**
     * Executes a single step of the State Machine
     */
    async step(taskId: string): Promise<string> {
        const task = await db.agentTask.findUnique({
            where: { id: taskId },
            include: { logs: true },
        });

        if (!task) throw new Error("Task not found");
        const currentState = task.status as AgentState;

        if (currentState === AgentState.COMPLETED || currentState === AgentState.FAILED) return currentState;
        if (currentState === AgentState.REVIEWING) return currentState; // Human intervention needed

        // 1. Context Construction
        const history = task.logs.map((l: any) => `${l.type}: ${l.content}`).join("\n");
        const systemPrompt = this.buildPrompt(task.goal, currentState, history, task.context);

        // 2. Gateway & Firewall
        const { safeText, map } = sovereignFirewall.processOutbound(systemPrompt);
        const rawResponse = await modelGateway.generate({
            prompt: safeText,
            complexity: currentState === AgentState.PLANNING ? TaskComplexity.STRATEGIC : TaskComplexity.ROUTINE
        });
        const restoredResponse = sovereignFirewall.processInbound(rawResponse, map);

        // 3. State-Specific Logic
        if (currentState === AgentState.PLANNING) {
            // Expecting a PLAN output
            await this.log(taskId, "THOUGHT", restoredResponse);

            if (restoredResponse.includes("PLAN:")) {
                // Naive parse: extract plan
                const parts = restoredResponse.split("PLAN:");
                const plan = parts.length > 1 ? parts[1].trim() : "No plan found";
                await db.agentTask.update({
                    where: { id: taskId },
                    data: {
                        plan: plan.split("\n"),
                        status: AgentState.EXECUTING
                    }
                });
                await this.log(taskId, "SYSTEM", "Plan accepted. Transitioning to EXECUTING.");
                return AgentState.EXECUTING;
            }
        }

        if (currentState === AgentState.EXECUTING) {
            // Expecting ACTION or DONE
            const { thought, action, params } = this.parseResponse(restoredResponse);
            const confidence = this.mockConfidenceScore(restoredResponse); // In real implementation, comes from Gateway logprobs

            await this.log(taskId, "THOUGHT", thought);

            // SAFETY VALVE: Low Confidence
            if (action && confidence < 0.7) {
                await this.log(taskId, "SYSTEM", `Low Confidence (${confidence}). Pausing for HUMAN REVIEW.`);
                await db.agentTask.update({ where: { id: taskId }, data: { status: AgentState.REVIEWING } });

                // Trigger Approval Request
                await ApprovalService.createRequest(
                    task.teamId,
                    task.userId || "SYSTEM_AGENT",
                    "AGENT_ACTION",
                    "AgentTask",
                    taskId,
                    `Low confidence decision (${confidence}) for action: ${action}`,
                    { proposedAction: action, params, thought }
                );

                return AgentState.REVIEWING;
            }

            if (action) {
                await this.log(taskId, "ACTION", `${action} with ${JSON.stringify(params)}`);
                try {
                    const tool = toolRegistry.get(action.trim());
                    if (!tool) throw new Error(`Tool ${action} not found`);
                    const result = await tool.execute(params, task.context);
                    await this.log(taskId, "OBSERVATION", JSON.stringify(result));
                } catch (error: any) {
                    await this.log(taskId, "OBSERVATION", `Error: ${error.message}`);
                }
            } else {
                if (thought.includes("DONE")) {
                    await db.agentTask.update({ where: { id: taskId }, data: { status: AgentState.COMPLETED } });
                    return AgentState.COMPLETED;
                }
            }
        }

        return AgentState.EXECUTING;
    }

    // --- Helpers ---

    private buildPrompt(goal: string, state: AgentState, history: string, context: any) {
        if (state === AgentState.PLANNING) {
            return `
      GOAL: ${goal}
      CONTEXT: ${JSON.stringify(context)}
      HISTORY: ${history}
      
      You are an Architect. DO NOT EXECUTE yet.
      Create a step-by-step PLAN to achieve the goal.
      Format:
      THOUGHT: <reasoning>
      PLAN:
      1. <step 1>
      2. <step 2>
      `;
        } else {
            return `
       GOAL: ${goal}
       CONTEXT: ${JSON.stringify(context)}
       HISTORY: ${history}
       
       You are an Executor. Follow the plan.
       Available Tools: ${toolRegistry.list().map(t => t.name).join(", ")}
       
       Format:
       THOUGHT: <reasoning>
       ACTION: <tool_name> | <json_params>
       OR
       THOUGHT: DONE
       `;
        }
    }

    private mockConfidenceScore(text: string): number {
        return text.length > 50 ? 0.9 : 0.6; // Mock heuristic
    }

    private async log(taskId: string, type: string, content: string) {
        const count = await db.agentLog.count({ where: { taskId } });
        await db.agentLog.create({
            data: { taskId, type, content, stepNumber: count + 1 },
        });
    }

    private parseResponse(text: string) {
        const thoughtMatch = text.match(/THOUGHT:(.*?)(ACTION:|$)/s);
        const actionMatch = text.match(/ACTION:(.*?)\|/s);
        const paramsMatch = text.match(/\|(.*)/s);
        return {
            thought: thoughtMatch && thoughtMatch[1] ? thoughtMatch[1].trim() : text,
            action: actionMatch && actionMatch[1] ? actionMatch[1].trim() : null,
            params: paramsMatch && paramsMatch[1] ? JSON.parse(paramsMatch[1].trim()) : {},
        };
    }
}

export const agentExecutor = new AgentExecutor();
