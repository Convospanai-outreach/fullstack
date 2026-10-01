// Pure helpers for the creator funnel content calendar (/content/calendar). All dates are the
// viewer's local time; the API stores UTC plus the IANA zone the post was scheduled in.

export type FunnelStage = "TOFU" | "MOFU" | "BOFU" | "POST";
export type CalendarView = "month" | "week";

export const STAGES: FunnelStage[] = ["TOFU", "MOFU", "BOFU", "POST"];

export const STAGE_META: Record<FunnelStage, { label: string; className: string; bar: string }> = {
    TOFU: { label: "Reach new people", className: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300", bar: "bg-sky-500" },
    MOFU: { label: "Build trust", className: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300", bar: "bg-violet-500" },
    BOFU: { label: "Ask for the sale", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", bar: "bg-amber-500" },
    POST: { label: "Customers", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" },
};

export const STATUS_LABEL: Record<string, string> = {
    DRAFT: "Draft",
    IN_REVIEW: "Waiting for approval",
    APPROVED: "Approved",
    PUBLISHING: "Publishing",
    PUBLISHED: "Published",
    FAILED: "Failed",
};

/** Midnight of the same local day. */
export function startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Calendar-day arithmetic in local time (not 24h steps, so DST changes don't shift days). */
export function addDays(d: Date, days: number): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function startOfWeek(d: Date): Date {
    const day = startOfDay(d);
    return addDays(day, -((day.getDay() + 6) % 7)); // weeks start on Monday
}

/** The days a view shows: 6 full weeks around the anchor's month, or the anchor's week. */
export function visibleDays(view: CalendarView, anchor: Date): Date[] {
    const first = view === "month" ? startOfWeek(new Date(anchor.getFullYear(), anchor.getMonth(), 1)) : startOfWeek(anchor);
    return Array.from({ length: view === "month" ? 42 : 7 }, (_, i) => addDays(first, i));
}

/** [from, to) covering a view's days, for the posts query. */
export function viewRange(view: CalendarView, anchor: Date): { from: Date; to: Date } {
    const days = visibleDays(view, anchor);
    return { from: days[0], to: addDays(days[days.length - 1], 1) };
}

export function shiftAnchor(view: CalendarView, anchor: Date, step: number): Date {
    return view === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + step, 1) : addDays(anchor, 7 * step);
}

export function dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Drag-to-reschedule: same local clock time, new calendar day (safe across DST changes). */
export function moveToDay(at: Date, day: Date): Date {
    const moved = new Date(at);
    moved.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    return moved;
}

/** Value for an <input type="datetime-local"> in local time. */
export function toLocalInput(d: Date | null): string {
    if (!d) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): Date | null {
    if (!value) return null;
    const d = new Date(value); // "YYYY-MM-DDTHH:mm" parses as local time
    return Number.isNaN(d.getTime()) ? null : d;
}

/** Share of posts per stage, as whole percentages, plus the count behind them. */
export function stageMix(posts: { funnelStage: FunnelStage }[]): { total: number; pct: Record<FunnelStage, number> } {
    const counts: Record<FunnelStage, number> = { TOFU: 0, MOFU: 0, BOFU: 0, POST: 0 };
    for (const p of posts) counts[p.funnelStage]++;
    const total = posts.length;
    const pct = { ...counts };
    for (const s of STAGES) pct[s] = total ? Math.round((counts[s] / total) * 100) : 0;
    return { total, pct };
}

export type SocialPlatform = "FACEBOOK_PAGE" | "INSTAGRAM" | "LINKEDIN_MEMBER" | "LINKEDIN_ORG";

export type CalendarAccount = { id: string; platform: SocialPlatform; handle: string | null; status: string };

export type CalendarPost = {
    id: string;
    body: string;
    mediaUrls: string[];
    funnelStage: FunnelStage;
    status: keyof typeof STATUS_LABEL;
    scheduledAt: string | null;
    timezone: string | null;
    approvalRequestId: string | null;
    reviewNote: string | null;
    targets: { id: string; status: string; lastError: string | null; socialAccount: CalendarAccount }[];
};

/** Posts that can still be edited or moved (not publishing or published). */
export function isEditable(post: Pick<CalendarPost, "status">): boolean {
    return ["DRAFT", "IN_REVIEW", "APPROVED", "FAILED"].includes(post.status);
}
