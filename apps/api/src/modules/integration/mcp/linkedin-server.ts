import { prisma } from "@/lib/db";

export interface HelperTool {
    name: string;
    description: string;
    inputSchema: any;
    handler: (args: any) => Promise<any>;
}

export class LinkedInMCPServer {
    private tools: HelperTool[] = [];

    constructor() {
        this.registerTools();
    }

    private registerTools() {
        this.tools.push({
            name: "queue_linkedin_action",
            description: "Enqueue a LinkedIn touchpoint task for the extension to pick up",
            inputSchema: {
                type: "object",
                properties: {
                    teamId: { type: "string" },
                    leadId: { type: "string" },
                    actionType: { type: "string", enum: ["VIEW_PROFILE", "LIKE_POST", "CONNECT", "SEND_INMAIL"] },
                    profileUrl: { type: "string" },
                    personalizedNote: { type: "string" }
                },
                required: ["teamId", "actionType", "profileUrl"]
            },
            handler: async ({ teamId, leadId, actionType, profileUrl, personalizedNote }) => {
                if (process.env.LINKEDIN_AUTOMATION_ENABLED !== "true") {
                    throw new Error("LinkedIn automation is globally disabled");
                }
                // Normalize URL to prevent any random string injection
                let normalizedUrl = profileUrl;
                try {
                    const u = new URL(profileUrl);
                    if (!u.hostname.includes("linkedin.com")) throw new Error();
                    normalizedUrl = u.toString();
                } catch {
                    throw new Error("Invalid LinkedIn profile URL");
                }
                
                const job = await prisma.job.create({
                    data: {
                        teamId,
                        type: actionType,
                        status: "queued",
                        priority: 50,
                        payload: {
                            leadId,
                            profileUrl: normalizedUrl,
                            personalizedNote
                        }
                    }
                });
                
                return { success: true, jobId: job.id };
            }
        });

        this.tools.push({
            name: "get_linkedin_task_status",
            description: "Check the status of a scheduled LinkedIn task",
            inputSchema: {
                type: "object",
                properties: {
                    taskId: { type: "string" },
                    teamId: { type: "string" }
                },
                required: ["taskId", "teamId"]
            },
            handler: async ({ taskId, teamId }) => {
                const job = await prisma.job.findFirst({
                    where: { id: taskId, teamId },
                    select: { id: true, status: true, result: true, error: true, startedAt: true, completedAt: true }
                });
                if (!job) throw new Error("Task not found");
                return { task: job };
            }
        });

        this.tools.push({
            name: "get_linkedin_daily_cap",
            description: "Get the current daily cap usage for LinkedIn actions",
            inputSchema: {
                type: "object",
                properties: {
                    teamId: { type: "string" }
                },
                required: ["teamId"]
            },
            handler: async ({ teamId }) => {
                const limit = Number(process.env.LINKEDIN_DAILY_MAX_INVITES) || 15;
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);

                const actionsToday = await prisma.job.count({
                    where: {
                        teamId,
                        type: { in: ["VIEW_PROFILE", "LIKE_POST", "CONNECT", "SEND_INMAIL"] },
                        completedAt: { gte: startOfDay }
                    }
                });

                return {
                    teamId,
                    used: actionsToday,
                    limit,
                    remaining: Math.max(0, limit - actionsToday)
                };
            }
        });
        
        this.tools.push({
            name: "report_linkedin_stop",
            description: "Report an emergency stop for a LinkedIn task or session",
            inputSchema: {
                type: "object",
                properties: {
                    teamId: { type: "string" },
                    taskId: { type: "string" },
                    stopReason: { type: "string", enum: ["VERIFICATION_REQUIRED", "INVITE_LIMIT_REACHED", "WARNING_DETECTED", "CHECKPOINT_DETECTED", "MANUAL_STOP"] }
                },
                required: ["teamId", "stopReason"]
            },
            handler: async ({ teamId, taskId, stopReason }) => {
                if (taskId) {
                    await prisma.job.updateMany({
                        where: { id: taskId, teamId },
                        data: {
                            status: "failed",
                            error: `Stopped due to: ${stopReason}`,
                            completedAt: new Date()
                        }
                    });
                }
                
                await prisma.systemEvent.create({
                    data: {
                        teamId,
                        type: "SYSTEM",
                        name: "LINKEDIN_EMERGENCY_STOP",
                        timestamp: new Date(),
                        payload: { stopReason, taskId }
                    }
                });
                
                return { success: true, stopReason };
            }
        });
    }

    getTools() {
        return this.tools.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema
        }));
    }

    async callTool(name: string, args: any) {
        const tool = this.tools.find(t => t.name === name);
        if (!tool) throw new Error(`Tool not found: ${name}`);
        return tool.handler(args);
    }
}

export const linkedinServer = new LinkedInMCPServer();
