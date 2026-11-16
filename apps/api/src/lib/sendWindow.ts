// Recipient send windows: send only on the allowed days and hours in the recipient's local time, and when a send
// falls outside the window, give back the next window start (with a little jitter) so the job is moved, never dropped.
// Pure and clock-free (the caller passes `now`). Mirrored byte-for-byte in apps/web/src/lib/sendWindow.ts; a parity
// test keeps the two copies identical.

export type SendWindowSettings = {
    enabled: boolean;
    days: number[]; // 0 = Sunday ... 6 = Saturday, in the recipient's local time
    startHour: number; // inclusive, 0-23
    endHour: number; // exclusive, 1-24
    timeZone: string; // used when nothing better is known about the recipient
};

// Off until a team turns it on, so adding this changes nothing for existing teams.
export const DEFAULT_SEND_WINDOW: SendWindowSettings = {
    enabled: false,
    days: [1, 2, 3, 4, 5],
    startHour: 8,
    endHour: 18,
    timeZone: "UTC",
};

export type TimeZoneSource = "lead" | "location" | "phone" | "fallback";

export function isValidTimeZone(zone: unknown): zone is string {
    if (typeof zone !== "string" || !zone) return false;
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: zone });
        return true;
    } catch {
        return false;
    }
}

// Bad or partial settings fall back field by field to the defaults.
export function resolveSendWindow(raw: unknown): SendWindowSettings {
    const r = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
    const d = DEFAULT_SEND_WINDOW;
    const rawDays = r["days"];
    const days = Array.isArray(rawDays) ? [...new Set(rawDays.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 6))] : [];
    const rawStart = r["startHour"];
    const rawEnd = r["endHour"];
    const startHour = typeof rawStart === "number" && Number.isInteger(rawStart) && rawStart >= 0 && rawStart <= 23 ? rawStart : d.startHour;
    let endHour = typeof rawEnd === "number" && Number.isInteger(rawEnd) && rawEnd >= 1 && rawEnd <= 24 ? rawEnd : d.endHour;
    if (endHour <= startHour) endHour = Math.min(24, startHour + 1);
    const zone = r["timeZone"];
    return {
        enabled: r["enabled"] === true,
        days: days.length > 0 ? days.sort() : [...d.days],
        startHour,
        endHour,
        timeZone: isValidTimeZone(zone) ? zone : d.timeZone,
    };
}

// A starting set of common markets. A country with several zones gets the zone of its main business centre.
const COUNTRY_ZONES: { names: string[]; zone: string }[] = [
    { names: ["india"], zone: "Asia/Kolkata" },
    { names: ["united arab emirates", "uae", "dubai", "abu dhabi"], zone: "Asia/Dubai" },
    { names: ["united kingdom", "uk", "england", "london", "scotland"], zone: "Europe/London" },
    { names: ["ireland"], zone: "Europe/Dublin" },
    { names: ["germany", "berlin"], zone: "Europe/Berlin" },
    { names: ["france", "paris"], zone: "Europe/Paris" },
    { names: ["netherlands", "amsterdam"], zone: "Europe/Amsterdam" },
    { names: ["spain", "madrid"], zone: "Europe/Madrid" },
    { names: ["italy", "milan"], zone: "Europe/Rome" },
    { names: ["singapore"], zone: "Asia/Singapore" },
    { names: ["australia", "sydney", "melbourne"], zone: "Australia/Sydney" },
    { names: ["new zealand", "auckland"], zone: "Pacific/Auckland" },
    { names: ["japan", "tokyo"], zone: "Asia/Tokyo" },
    { names: ["saudi arabia", "riyadh"], zone: "Asia/Riyadh" },
    { names: ["south africa", "johannesburg"], zone: "Africa/Johannesburg" },
    { names: ["nigeria", "lagos"], zone: "Africa/Lagos" },
    { names: ["brazil", "sao paulo"], zone: "America/Sao_Paulo" },
    { names: ["new york", "boston", "miami", "atlanta"], zone: "America/New_York" },
    { names: ["chicago", "dallas", "houston", "austin"], zone: "America/Chicago" },
    { names: ["denver"], zone: "America/Denver" },
    { names: ["san francisco", "los angeles", "seattle", "california"], zone: "America/Los_Angeles" },
    { names: ["canada", "toronto"], zone: "America/Toronto" },
    { names: ["united states", "usa", "us"], zone: "America/New_York" },
];

// Longest prefix first, so +971 is tried before +97 or +9. +1 is left out: it spans too many zones to guess.
const PHONE_ZONES: [string, string][] = [
    ["971", "Asia/Dubai"], ["966", "Asia/Riyadh"], ["353", "Europe/Dublin"], ["234", "Africa/Lagos"],
    ["91", "Asia/Kolkata"], ["44", "Europe/London"], ["49", "Europe/Berlin"], ["33", "Europe/Paris"],
    ["31", "Europe/Amsterdam"], ["34", "Europe/Madrid"], ["39", "Europe/Rome"], ["65", "Asia/Singapore"],
    ["61", "Australia/Sydney"], ["64", "Pacific/Auckland"], ["81", "Asia/Tokyo"], ["27", "Africa/Johannesburg"],
    ["55", "America/Sao_Paulo"],
].sort((a, b) => b[0].length - a[0].length) as [string, string][];

function zoneFromLocation(location: string): string | null {
    const text = ` ${location.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ")} `;
    for (const { names, zone } of COUNTRY_ZONES) {
        if (names.some((n) => text.includes(` ${n} `))) return zone;
    }
    return null;
}

function zoneFromPhone(phone: string): string | null {
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, "");
    // Only an international number (+ or 00 prefix) says anything about the country.
    const international = trimmed.startsWith("+") ? digits : trimmed.startsWith("00") ? digits.slice(2) : null;
    if (!international) return null;
    for (const [code, zone] of PHONE_ZONES) if (international.startsWith(code)) return zone;
    return null;
}

// The recipient's timezone and which source it came from: the lead's own zone, then their location text, then the
// country code of their phone number, then the team fallback.
export function resolveRecipientTimeZone(
    lead: { location?: string | null; phone?: string | null; marketContext?: unknown } | null | undefined,
    fallbackZone: string,
): { timeZone: string; source: TimeZoneSource } {
    const own = lead?.marketContext && typeof lead.marketContext === "object" ? (lead.marketContext as Record<string, unknown>)["timezone"] : null;
    if (isValidTimeZone(own)) return { timeZone: own, source: "lead" };
    const fromLocation = lead?.location ? zoneFromLocation(lead.location) : null;
    if (fromLocation) return { timeZone: fromLocation, source: "location" };
    const fromPhone = lead?.phone ? zoneFromPhone(lead.phone) : null;
    if (fromPhone) return { timeZone: fromPhone, source: "phone" };
    return { timeZone: isValidTimeZone(fallbackZone) ? fallbackZone : "UTC", source: "fallback" };
}

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

function localParts(instant: Date, timeZone: string): LocalParts {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone, hourCycle: "h23", weekday: "short",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    const p: Record<string, string> = {};
    for (const part of dtf.formatToParts(instant)) if (part.type !== "literal") p[part.type] = part.value;
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p["weekday"]!);
    return { year: Number(p["year"]), month: Number(p["month"]), day: Number(p["day"]), hour: Number(p["hour"]), minute: Number(p["minute"]), weekday };
}

// The instant at which the wall clock in `timeZone` reads year-month-day hour:00.
function instantAtLocal(year: number, month: number, day: number, hour: number, timeZone: string): Date {
    const naive = Date.UTC(year, month - 1, day, hour, 0, 0);
    const offsetOf = (at: number) => {
        const p = localParts(new Date(at), timeZone);
        return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0) - Math.floor(at / 60000) * 60000;
    };
    // Try the offsets in force a day before and a day after, which straddle any DST change that day.
    const candidates = [naive - offsetOf(naive - 86400000), naive - offsetOf(naive + 86400000)];
    const reads = (at: number) => {
        const p = localParts(new Date(at), timeZone);
        return p.hour === hour % 24 && p.minute === 0;
    };
    const valid = candidates.filter(reads);
    // Clocks repeated (fall back): the first occurrence. Clocks skipped (spring forward, so this wall time never
    // happens): the first instant after the gap, not an hour before it.
    return new Date(valid.length > 0 ? Math.min(...valid) : Math.max(...candidates));
}

export function isInsideSendWindow(now: Date, timeZone: string, window: SendWindowSettings): boolean {
    const p = localParts(now, timeZone);
    return window.days.includes(p.weekday) && p.hour >= window.startHour && p.hour < window.endHour;
}

// Small stable number from a string, so the same job always gets the same jitter and tests need no random source.
function hashOf(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

const MAX_JITTER_MINUTES = 90;

// null when `now` is already inside the window (send now). Otherwise the next window start plus 0-90 minutes of jitter
// (never past the end of that window), so a batch held over the night does not all fire at the same minute.
export function nextSendTime(now: Date, timeZone: string, window: SendWindowSettings, jitterKey: string): Date | null {
    if (isInsideSendWindow(now, timeZone, window)) return null;
    const today = localParts(now, timeZone);
    for (let ahead = 0; ahead <= 8; ahead++) {
        // Walk calendar days using UTC date maths on the local date, which has no DST of its own.
        const probe = new Date(Date.UTC(today.year, today.month - 1, today.day + ahead));
        const weekday = probe.getUTCDay();
        if (!window.days.includes(weekday)) continue;
        const start = instantAtLocal(probe.getUTCFullYear(), probe.getUTCMonth() + 1, probe.getUTCDate(), window.startHour, timeZone);
        if (start.getTime() <= now.getTime()) continue; // today's window already started or has ended
        const windowMinutes = (window.endHour - window.startHour) * 60;
        const jitter = hashOf(jitterKey) % Math.min(MAX_JITTER_MINUTES, Math.max(1, windowMinutes - 1));
        return new Date(start.getTime() + jitter * 60_000);
    }
    return null; // unreachable with at least one allowed day
}
