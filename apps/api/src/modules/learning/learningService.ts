import { prisma } from "@/lib/db";

const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

export class LearningService {
    // NOT FIXED: self-fetches /learning/feedback, and has zero callers anywhere in the
    // codebase - the real route (POST /learning/feedback) bypasses this service entirely
    // with its own direct prisma.agentFeedback.create call. Left untouched rather than
    // guessed at, matching how 121721a left PipelineService.updateTask untouched for the
    // same reason.
    static async recordFeedback(
        teamId: string,
        userId: string,
        messageId: string,
        rating: number,
        comment?: string
    ) {
        try {
            const res = await fetch(`${API_URL}/learning/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, userId, messageId, rating, comment })
            });
            if (!res.ok) throw new Error("Learning feedback failure");
            return await res.json();
        } catch (e) {
            console.error("Learning feedback proxy failed:", e);
        }
    }

    // Was self-fetching POST /learning/memories, which self-referentially calls this exact
    // service's route. Replaced with the same prisma.agentMemory query the live route
    // (GET /learning/memories) already runs.
    //
    // The live route returns raw AgentMemory rows ({ memories: [...] }), but every real
    // caller (emailComposer.ts's composeNodeA/B/C, and routes/inbox/suggest) types this as
    // string[] and does `.join("\n")` straight into an AI prompt - the route's own shape was
    // never actually consumable by its callers. Formatted each memory as "key: value",
    // mirroring the pairing already documented in the AgentMemory model's own schema comment
    // (e.g. "tone_preference": "Always use emojis").
    //
    // No try/catch here (unlike the old self-fetch's swallow-into-[]): a DB failure must
    // propagate rather than silently render "no memories" into every AI prompt, which the
    // caller couldn't distinguish from "this team genuinely has none yet." Matches the
    // analyticsService precedent (no try/catch; callers already have their own 500 handling).
    static async getMemories(teamId: string) {
        if (!teamId) return [];

        const memories = await prisma.agentMemory.findMany({
            where: { teamId },
            orderBy: { createdAt: "desc" }
        });

        return memories.map((m) => `${m.key}: ${m.value}`);
    }
}
