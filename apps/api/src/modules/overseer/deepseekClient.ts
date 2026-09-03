import OpenAI from "openai";
import { logger } from "@/lib/logger";

export type StallCandidate = {
    enrollmentId: string;
    sequenceName: string;
    stage: string;
    stallDays: number;
};

export type StallJudgment = {
    enrollmentId: string;
    nudgeType: "RESEND_STEP" | "ROUTE_MANUAL" | "LIKELY_DEAD";
    suggestion: string;
};

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env["DEEPSEEK_MODEL"] || "deepseek-chat";
const DEEPSEEK_TIMEOUT_MS = 30000;

function fallbackJudgment(candidate: StallCandidate): StallJudgment {
    return {
        enrollmentId: candidate.enrollmentId,
        nudgeType: "ROUTE_MANUAL",
        suggestion: `Stalled ${candidate.stallDays.toFixed(1)} days at ${candidate.stage} with no recorded next step - flagged for manual follow-up (Overseer judgment call unavailable).`
    };
}

/**
 * Deliberately never sent: lead name, email, phone, or any message content -
 * candidates carry only enrollment/sequence identifiers and stall duration,
 * so there is no PII redaction step to get wrong (see plan §08 failure mode 6).
 */
export async function judgeStalledEnrollments(candidates: StallCandidate[]): Promise<StallJudgment[]> {
    if (candidates.length === 0) return [];

    const apiKey = process.env["DEEPSEEK_API_KEY"];
    if (!apiKey) {
        return candidates.map(fallbackJudgment);
    }

    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    const prompt = [
        "You are a funnel-operations reviewer. For each stalled sequence enrollment below, ",
        "suggest exactly one action from RESEND_STEP, ROUTE_MANUAL, or LIKELY_DEAD, plus a one-sentence reason.",
        "Respond with ONLY a JSON array, one object per input item, each shaped as:",
        '{"enrollmentId": string, "nudgeType": "RESEND_STEP" | "ROUTE_MANUAL" | "LIKELY_DEAD", "suggestion": string}',
        "",
        "Stalled enrollments:",
        JSON.stringify(candidates, null, 2)
    ].join("\n");

    try {
        const response = await Promise.race([
            client.chat.completions.create({
                model: DEEPSEEK_MODEL,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2
            }),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DEEPSEEK_TIMEOUT")), DEEPSEEK_TIMEOUT_MS))
        ]);

        const text = response.choices?.[0]?.message?.content || "";
        const jsonStart = text.indexOf("[");
        const jsonEnd = text.lastIndexOf("]");
        if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON array in DeepSeek response");

        const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as StallJudgment[];
        const byId = new Map(parsed.filter((p) => p && p.enrollmentId).map((p) => [p.enrollmentId, p]));

        const validTypes = new Set(["RESEND_STEP", "ROUTE_MANUAL", "LIKELY_DEAD"]);
        return candidates.map((candidate) => {
            const judged = byId.get(candidate.enrollmentId);
            if (!judged || !validTypes.has(judged.nudgeType) || typeof judged.suggestion !== "string") {
                return fallbackJudgment(candidate);
            }
            return judged;
        });
    } catch (error: any) {
        logger.warn("[Overseer] DeepSeek judgment call failed, using fallback nudges", {
            error: error?.message || String(error)
        });
        return candidates.map(fallbackJudgment);
    }
}
