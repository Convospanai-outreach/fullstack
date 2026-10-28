// What the copilot extension may store on the server. Only the store edition's bots are synced;
// Replier threads, Pruner lists and chat exports stay in the browser.

const WHOLE_KEYS = new Set([
    "commentor_settings", "commentor_stats", "commentor_done", "commentor_log", "commentor_replied", "commentor_me",
    "commentor_leads", "commentor_queue", "commentor_invited", "commentor_activity",
    "or_settings", "or_stats", "or_log", "or_engine",
    "contacts_settings", "contacts_log", "contacts_lastSync"
]);
const MAP_KEYS = [/^contacts_data$/, /^or_campaigns$/, /^or_leads_[A-Za-z0-9_-]{1,80}$/];

export const MAX_STATE_ROWS_PER_USER = 50_000;
export const MAX_VALUE_CHARS = 64_000;

export function syncableKey(key: unknown): key is string {
    return typeof key === "string" && (WHOLE_KEYS.has(key) || MAP_KEYS.some((re) => re.test(key)));
}

const EVENT_TYPE = /^[A-Z][A-Z0-9_]{1,63}$/;
const FEATURES = new Set(["general", "auto_comment", "lead_hunter", "outreach", "contacts_fetcher"]);

export type CleanEvent = { eventId: string; type: string; feature: string; detail: string; data: object; occurredAt: Date };

/** A valid event in the shape we store, or the reason it is rejected. */
export function cleanEvent(e: any): CleanEvent | { error: string } {
    if (!e || typeof e !== "object") return { error: "not an object" };
    if (typeof e.event_id !== "string" || !e.event_id || e.event_id.length > 120) return { error: "bad event_id" };
    if (typeof e.type !== "string" || !EVENT_TYPE.test(e.type)) return { error: "bad type" };
    const feature = typeof e.feature === "string" && FEATURES.has(e.feature) ? e.feature : null;
    if (!feature) return { error: "feature not synced" };
    const at = new Date(e.occurred_at);
    if (Number.isNaN(at.getTime()) || at.getTime() > Date.now() + 5 * 60_000) return { error: "bad occurred_at" };
    const data = e.data && typeof e.data === "object" && !Array.isArray(e.data) ? e.data : {};
    if (JSON.stringify(data).length > 32_000) return { error: "data too large" };
    return { eventId: e.event_id, type: e.type, feature, detail: String(e.detail || "").slice(0, 500), data, occurredAt: at };
}
