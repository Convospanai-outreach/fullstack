import { logger } from "@/lib/logger";

export interface SentinelReport {
    status: "PASS" | "FAIL" | "WARN";
    data_score: number;
    security_score: number;
    connection_health: "STABLE" | "DEGRADED" | "OFFLINE";
    logs: string[];
    action_taken: string;
    suggested_actions?: string[];
}

// Scraped text ends up in LLM prompts (intent scoring), so text that tries to instruct the model is
// the risk worth stopping. These phrases are rare in genuine profile and post text.
const PROMPT_INJECTION = [
    /\b(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier)\b/i,
    /\b(reveal|print|show|repeat)\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions)\b/i,
    /<\|?\s*(im_start|im_end|system)\s*\|?>/i,
    /\[\s*\/?INST\s*\]/i,
];
// Raw scraped pages can legitimately contain these, so they are reported, not blocked.
const ACTIVE_CONTENT = /<script\b|javascript:|\bon(error|load|click)\s*=/i;

const MAX_SCAN_CHARS = 200_000;
const MAX_DEPTH = 12;
const SLOW_NODE_MS = 30_000;

// The text values of a payload, bounded in size and depth so a hostile payload cannot make the check expensive.
function collectText(value: unknown): string {
    const parts: string[] = [];
    let used = 0;
    const stack: Array<[unknown, number]> = [[value, 0]];
    while (stack.length > 0 && used < MAX_SCAN_CHARS) {
        const [current, depth] = stack.pop()!;
        if (typeof current === "string") {
            const piece = current.slice(0, MAX_SCAN_CHARS - used);
            parts.push(piece);
            used += piece.length;
        } else if (depth < MAX_DEPTH && current && typeof current === "object") {
            for (const child of Object.values(current as Record<string, unknown>)) stack.push([child, depth + 1]);
        }
    }
    return parts.join("\n");
}

/**
 * Checks a scraped payload and the node that fetched it, in process: no network call and no
 * outside service, so it cannot be down. It fails a payload that is not an object, quarantines
 * text that tries to instruct the model reading it, and warns about missing data, active HTML
 * and a struggling node.
 */
export class SentinelService {
    static async evaluate(payload: unknown, nodeMetrics: any): Promise<SentinelReport> {
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            return {
                status: "FAIL",
                data_score: 0,
                security_score: 1,
                connection_health: "STABLE",
                logs: ["Payload is not an object."],
                action_taken: "NONE",
            };
        }

        const record = payload as Record<string, unknown>;
        const logs: string[] = [];
        const suggested: string[] = [];
        let quarantine = false;

        let dataScore = 1;
        if (Object.keys(record).length === 0) {
            dataScore = 0;
            logs.push("empty_payload");
        } else if (typeof record["url"] !== "string" && typeof record["thread_url"] !== "string") {
            dataScore = 0.7;
            logs.push("missing_source_url");
        }

        let securityScore = 1;
        const text = collectText(record);
        if (PROMPT_INJECTION.some((pattern) => pattern.test(text))) {
            securityScore = 0.2;
            quarantine = true;
            logs.push("prompt_injection");
            suggested.push("Review the source page for text aimed at the model.");
        } else if (ACTIVE_CONTENT.test(text)) {
            securityScore = 0.6;
            logs.push("active_content");
            suggested.push("Strip markup from the scraped text before it is displayed.");
        }

        const statusCode = Number(nodeMetrics?.statusCode ?? 200);
        const errorCount = Number(nodeMetrics?.errorCount ?? 0);
        const latency = Number(nodeMetrics?.latency ?? 0);
        const degraded = statusCode >= 400 || errorCount > 0 || latency > SLOW_NODE_MS;
        if (degraded) {
            logs.push("node_degraded");
            suggested.push("Check the scraper node and its proxy.");
        }

        const flagged = logs.length > 0;
        if (flagged) {
            // Rule names only: the payload is somebody else's page.
            logger.warn("sentinel.flagged", { rules: logs, quarantined: quarantine });
        }

        return {
            status: flagged ? "WARN" : "PASS",
            data_score: dataScore,
            security_score: securityScore,
            connection_health: degraded ? "DEGRADED" : "STABLE",
            logs,
            action_taken: quarantine ? "QUARANTINED" : "NONE",
            ...(suggested.length > 0 ? { suggested_actions: suggested } : {}),
        };
    }
}
