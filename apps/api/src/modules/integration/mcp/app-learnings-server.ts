/**
 * App Learnings MCP Server
 * Exposes safe, team-scoped learning summaries for internal agents/services.
 */

import { prisma } from "@/lib/db";
import { PIIScrubber } from "@/lib/governance/PIIScrubber";

export interface HelperTool {
    name: string;
    description: string;
    inputSchema: any;
    handler: (args: any) => Promise<any>;
}

type LearningSnapshot = {
    teamId: string;
    lookbackDays: number;
    generatedAt: string;
    totals: {
        memories: number;
        feedbackEdits: number;
        events: number;
        ratings: number;
    };
    ratings: {
        positive: number;
        neutral: number;
        negative: number;
        average: number;
    };
    topEventNames: Array<{ name: string; count: number }>;
    topMemoryKeys: Array<{ key: string; count: number }>;
    recentMemories: Array<{
        id: string;
        key: string;
        value: string;
        confidence: number;
        createdAt: string;
    }>;
    recentEvents: Array<{
        id: string;
        type: string;
        name: string;
        timestamp: string;
    }>;
};

function toPositiveInteger(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.floor(parsed);
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function sanitizeText(input: unknown, maxLength: number): string {
    if (typeof input !== "string") return "";
    const trimmed = input.trim();
    if (!trimmed) return "";
    return PIIScrubber.scrub(trimmed).slice(0, maxLength);
}

function sanitizeJson(value: unknown, maxStringLength: number): unknown {
    if (typeof value === "string") {
        return sanitizeText(value, maxStringLength);
    }
    if (Array.isArray(value)) {
        return value.map(item => sanitizeJson(item, maxStringLength));
    }
    if (value && typeof value === "object") {
        const output: Record<string, unknown> = {};
        for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
            output[key] = sanitizeJson(nested, maxStringLength);
        }
        return output;
    }
    return value;
}

function getEventCounts(events: Array<{ name: string }>, maxItems: number) {
    const counts = new Map<string, number>();
    for (const event of events) {
        counts.set(event.name, (counts.get(event.name) || 0) + 1);
    }
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxItems)
        .map(([name, count]) => ({ name, count }));
}

function getMemoryKeyCounts(memories: Array<{ key: string }>, maxItems: number) {
    const counts = new Map<string, number>();
    for (const memory of memories) {
        counts.set(memory.key, (counts.get(memory.key) || 0) + 1);
    }
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxItems)
        .map(([key, count]) => ({ key, count }));
}

export class AppLearningsMCPServer {
    private tools: HelperTool[] = [];
    private readonly DEFAULT_LOOKBACK_DAYS = clamp(
        toPositiveInteger(process.env["MCP_LEARNINGS_DEFAULT_LOOKBACK_DAYS"], 14),
        1,
        90
    );
    private readonly MAX_LIMIT = clamp(
        toPositiveInteger(process.env["MCP_LEARNINGS_MAX_LIMIT"], 100),
        10,
        500
    );
    private readonly MAX_VALUE_CHARS = clamp(
        toPositiveInteger(process.env["MCP_LEARNINGS_MAX_VALUE_CHARS"], 2000),
        256,
        8000
    );

    constructor() {
        this.registerTools();
    }

    private assertTeamId(teamId: unknown): string {
        if (typeof teamId !== "string" || teamId.trim().length === 0) {
            throw new Error("team_id is required");
        }
        return teamId.trim();
    }

    private normalizeLimit(limit: unknown, fallback: number): number {
        return clamp(toPositiveInteger(limit, fallback), 1, this.MAX_LIMIT);
    }

    private normalizeLookbackDays(lookbackDays: unknown): number {
        return clamp(toPositiveInteger(lookbackDays, this.DEFAULT_LOOKBACK_DAYS), 1, 90);
    }

    private async buildLearningSnapshot(teamId: string, lookbackDays: number): Promise<LearningSnapshot> {
        const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

        const [
            memoryCount,
            feedbackLoopCount,
            eventCount,
            memories,
            events,
            feedbackRatings
        ] = await Promise.all([
            prisma.agentMemory.count({ where: { teamId } }),
            prisma.agentFeedbackLoop.count({ where: { teamId, createdAt: { gte: since } } }),
            prisma.systemEvent.count({ where: { teamId, timestamp: { gte: since } } }),
            prisma.agentMemory.findMany({
                where: { teamId },
                orderBy: { createdAt: "desc" },
                take: this.normalizeLimit(20, 20),
                select: { id: true, key: true, value: true, confidence: true, createdAt: true }
            }),
            prisma.systemEvent.findMany({
                where: { teamId, timestamp: { gte: since } },
                orderBy: { timestamp: "desc" },
                take: this.normalizeLimit(250, 250),
                select: { id: true, type: true, name: true, timestamp: true }
            }),
            prisma.agentFeedback.findMany({
                where: {
                    message: {
                        lead: {
                            teamId
                        }
                    }
                },
                orderBy: { createdAt: "desc" },
                take: this.normalizeLimit(500, 500),
                select: { rating: true }
            })
        ]);

        let positive = 0;
        let neutral = 0;
        let negative = 0;
        let sum = 0;

        for (const row of feedbackRatings) {
            const rating = Number(row.rating);
            if (Number.isFinite(rating)) {
                sum += rating;
                if (rating >= 4) positive += 1;
                else if (rating <= 2) negative += 1;
                else neutral += 1;
            }
        }

        const average = feedbackRatings.length > 0 ? Number((sum / feedbackRatings.length).toFixed(2)) : 0;

        return {
            teamId,
            lookbackDays,
            generatedAt: new Date().toISOString(),
            totals: {
                memories: memoryCount,
                feedbackEdits: feedbackLoopCount,
                events: eventCount,
                ratings: feedbackRatings.length
            },
            ratings: {
                positive,
                neutral,
                negative,
                average
            },
            topEventNames: getEventCounts(events, 8),
            topMemoryKeys: getMemoryKeyCounts(memories, 8),
            recentMemories: memories.map(memory => ({
                id: memory.id,
                key: sanitizeText(memory.key, 120),
                value: sanitizeText(memory.value, this.MAX_VALUE_CHARS),
                confidence: Number(memory.confidence ?? 0),
                createdAt: memory.createdAt.toISOString()
            })),
            recentEvents: events.map(event => ({
                id: event.id,
                type: sanitizeText(event.type, 80),
                name: sanitizeText(event.name, 120),
                timestamp: event.timestamp.toISOString()
            }))
        };
    }

    private toToon(snapshot: LearningSnapshot, maxRows: number): string {
        const rows = clamp(maxRows, 5, 200);
        const memoryRows = snapshot.recentMemories.slice(0, rows);
        const eventRows = snapshot.recentEvents.slice(0, rows);
        const topEventRows = snapshot.topEventNames.slice(0, rows);
        const topMemoryRows = snapshot.topMemoryKeys.slice(0, rows);

        const sections: string[] = [];

        sections.push("learning_totals[item,count]");
        sections.push(`memories,${snapshot.totals.memories}`);
        sections.push(`feedback_edits,${snapshot.totals.feedbackEdits}`);
        sections.push(`events,${snapshot.totals.events}`);
        sections.push(`ratings,${snapshot.totals.ratings}`);

        sections.push("");
        sections.push("learning_ratings[positive,neutral,negative,average]");
        sections.push(
            `${snapshot.ratings.positive},${snapshot.ratings.neutral},${snapshot.ratings.negative},${snapshot.ratings.average}`
        );

        sections.push("");
        sections.push("learning_top_events[name,count]");
        for (const event of topEventRows) {
            sections.push(`${event.name},${event.count}`);
        }

        sections.push("");
        sections.push("learning_top_memory_keys[key,count]");
        for (const key of topMemoryRows) {
            sections.push(`${key.key},${key.count}`);
        }

        sections.push("");
        sections.push("learning_recent_memories[key,confidence,created_at,value]");
        for (const memory of memoryRows) {
            sections.push(`${memory.key},${memory.confidence},${memory.createdAt},"${memory.value.replace(/"/g, "'")}"`);
        }

        sections.push("");
        sections.push("learning_recent_events[type,name,timestamp]");
        for (const event of eventRows) {
            sections.push(`${event.type},${event.name},${event.timestamp}`);
        }

        return sections.join("\n");
    }

    private registerTools() {
        this.tools.push({
            name: "read_app_learning_summary",
            description: "Read a sanitized summary of team-level app learnings, outcomes, and event trends.",
            inputSchema: {
                type: "object",
                properties: {
                    team_id: { type: "string", description: "Team ID to read learnings for" },
                    lookback_days: { type: "number", default: this.DEFAULT_LOOKBACK_DAYS }
                },
                required: ["team_id"],
                additionalProperties: false
            },
            handler: async ({ team_id, lookback_days }) => {
                const teamId = this.assertTeamId(team_id);
                const lookbackDays = this.normalizeLookbackDays(lookback_days);
                return this.buildLearningSnapshot(teamId, lookbackDays);
            }
        });

        this.tools.push({
            name: "read_app_learning_memories",
            description: "List recent team memories captured by the learning loop.",
            inputSchema: {
                type: "object",
                properties: {
                    team_id: { type: "string", description: "Team ID to read memories for" },
                    limit: { type: "number", default: 20 },
                    min_confidence: { type: "number", default: 0 },
                    key_prefix: { type: "string", description: "Optional key prefix filter" }
                },
                required: ["team_id"],
                additionalProperties: false
            },
            handler: async ({ team_id, limit = 20, min_confidence = 0, key_prefix }) => {
                const teamId = this.assertTeamId(team_id);
                const safeLimit = this.normalizeLimit(limit, 20);
                const minConfidence = Number.isFinite(Number(min_confidence)) ? Number(min_confidence) : 0;
                const keyPrefix = typeof key_prefix === "string" && key_prefix.trim().length > 0 ? key_prefix.trim() : null;

                const memories = await prisma.agentMemory.findMany({
                    where: {
                        teamId,
                        confidence: { gte: minConfidence },
                        ...(keyPrefix ? { key: { startsWith: keyPrefix } } : {})
                    },
                    orderBy: { createdAt: "desc" },
                    take: safeLimit
                });

                return {
                    teamId,
                    count: memories.length,
                    memories: memories.map(memory => ({
                        id: memory.id,
                        key: sanitizeText(memory.key, 120),
                        value: sanitizeText(memory.value, this.MAX_VALUE_CHARS),
                        confidence: Number(memory.confidence ?? 0),
                        createdAt: memory.createdAt.toISOString()
                    }))
                };
            }
        });

        this.tools.push({
            name: "search_app_learning_events",
            description: "Search recent learning-related system events for a team.",
            inputSchema: {
                type: "object",
                properties: {
                    team_id: { type: "string", description: "Team ID to search events for" },
                    query: { type: "string", description: "Optional text to match in event name/type/payload" },
                    event_names: { type: "array", items: { type: "string" } },
                    limit: { type: "number", default: 50 },
                    lookback_days: { type: "number", default: this.DEFAULT_LOOKBACK_DAYS }
                },
                required: ["team_id"],
                additionalProperties: false
            },
            handler: async ({ team_id, query, event_names, limit = 50, lookback_days }) => {
                const teamId = this.assertTeamId(team_id);
                const safeLimit = this.normalizeLimit(limit, 50);
                const lookbackDays = this.normalizeLookbackDays(lookback_days);
                const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

                const eventNames = Array.isArray(event_names)
                    ? event_names.map((value: unknown) => String(value || "").trim()).filter(Boolean)
                    : [];

                const events = await prisma.systemEvent.findMany({
                    where: {
                        teamId,
                        timestamp: { gte: since },
                        ...(eventNames.length > 0 ? { name: { in: eventNames } } : {})
                    },
                    orderBy: { timestamp: "desc" },
                    take: Math.max(safeLimit, 200)
                });

                const needle = typeof query === "string" && query.trim().length > 0 ? query.trim().toLowerCase() : "";
                const filtered = needle.length > 0
                    ? events.filter(event => {
                        const haystack = `${event.name} ${event.type} ${JSON.stringify(event.payload || {})}`.toLowerCase();
                        return haystack.includes(needle);
                    })
                    : events;

                return {
                    teamId,
                    lookbackDays,
                    count: Math.min(filtered.length, safeLimit),
                    events: filtered.slice(0, safeLimit).map(event => ({
                        id: event.id,
                        type: sanitizeText(event.type, 80),
                        name: sanitizeText(event.name, 120),
                        actorId: sanitizeText(event.actorId || "", 80) || null,
                        timestamp: event.timestamp.toISOString(),
                        payload: sanitizeJson(event.payload, 300)
                    }))
                };
            }
        });

        this.tools.push({
            name: "share_app_learning_memory",
            description: "Share a new team learning memory so other workflows and agents can reuse it.",
            inputSchema: {
                type: "object",
                properties: {
                    team_id: { type: "string", description: "Team ID to store memory for" },
                    key: { type: "string", description: "Learning key, for example tone_preference" },
                    value: { type: "string", description: "Learning value/content" },
                    confidence: { type: "number", default: 1 },
                    source: { type: "string", description: "Optional source tag for the memory" },
                    user_id: { type: "string", description: "Optional user ID that shared this learning" }
                },
                required: ["team_id", "key", "value"],
                additionalProperties: false
            },
            handler: async ({ team_id, key, value, confidence = 1, source, user_id }) => {
                const teamId = this.assertTeamId(team_id);
                const safeKey = sanitizeText(key, 120);
                const safeValue = sanitizeText(value, this.MAX_VALUE_CHARS);
                if (!safeKey || !safeValue) {
                    throw new Error("key and value are required");
                }

                const safeConfidence = Number.isFinite(Number(confidence))
                    ? clamp(Number(confidence), 0, 1)
                    : 1;

                const memory = await prisma.agentMemory.create({
                    data: {
                        teamId,
                        key: safeKey,
                        value: safeValue,
                        confidence: safeConfidence
                    }
                });

                await prisma.systemEvent.create({
                    data: {
                        type: "SYSTEM",
                        name: "APP_LEARNING_SHARED",
                        teamId,
                        actorId: typeof user_id === "string" && user_id.trim().length > 0 ? user_id.trim() : "SYSTEM",
                        payload: {
                            key: safeKey,
                            confidence: safeConfidence,
                            source: sanitizeText(source, 120) || "MCP"
                        }
                    }
                });

                return {
                    success: true,
                    memory: {
                        id: memory.id,
                        teamId: memory.teamId,
                        key: memory.key,
                        confidence: Number(memory.confidence ?? 0),
                        createdAt: memory.createdAt.toISOString()
                    }
                };
            }
        });

        this.tools.push({
            name: "read_app_learning_toon",
            description: "Export team learnings in compact TOON-style text for sharing with other systems.",
            inputSchema: {
                type: "object",
                properties: {
                    team_id: { type: "string", description: "Team ID to export learnings for" },
                    lookback_days: { type: "number", default: this.DEFAULT_LOOKBACK_DAYS },
                    max_rows: { type: "number", default: 30 }
                },
                required: ["team_id"],
                additionalProperties: false
            },
            handler: async ({ team_id, lookback_days, max_rows = 30 }) => {
                const teamId = this.assertTeamId(team_id);
                const lookbackDays = this.normalizeLookbackDays(lookback_days);
                const maxRows = this.normalizeLimit(max_rows, 30);
                const snapshot = await this.buildLearningSnapshot(teamId, lookbackDays);
                return {
                    teamId,
                    generatedAt: snapshot.generatedAt,
                    toon: this.toToon(snapshot, maxRows)
                };
            }
        });
    }

    getTools() {
        return this.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }));
    }

    async callTool(name: string, args: any) {
        const tool = this.tools.find(entry => entry.name === name);
        if (!tool) throw new Error(`Tool not found: ${name}`);
        return tool.handler(args);
    }
}

export const appLearningsServer = new AppLearningsMCPServer();

