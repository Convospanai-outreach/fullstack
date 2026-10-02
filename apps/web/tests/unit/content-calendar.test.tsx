import { renderToStaticMarkup } from "react-dom/server";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import ContentCalendarPage from "@/app/(dashboard)/content/calendar/page";
import { StageMixMeter } from "@/components/content/StageMixMeter";
import { startOfDay, viewRange, type CalendarPost } from "@/lib/contentCalendar";

const { from, to } = viewRange("month", startOfDay(new Date()));
const LIST_KEY = `/api/proxy/content/posts?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
const ACCOUNTS_KEY = "/api/proxy/social/accounts";
const MIX_KEY = "/api/proxy/content/stage-mix";

const account = { id: "acc-ig", platform: "INSTAGRAM" as const, handle: "@maker", status: "CONNECTED" };
const post = (overrides: Partial<CalendarPost>): CalendarPost => ({
    id: "post-1",
    body: "Three mistakes new founders make",
    mediaUrls: [],
    funnelStage: "TOFU",
    status: "DRAFT",
    scheduledAt: new Date(from.getTime() + 10 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(),
    timezone: "Asia/Kolkata",
    approvalRequestId: null,
    reviewNote: null,
    targets: [{ id: "t-1", status: "PENDING", lastError: null, socialAccount: account }],
    ...overrides,
});

const render = (node: React.ReactNode, fallback: Record<string, unknown>) =>
    renderToStaticMarkup(<SWRConfig value={{ fallback, provider: () => new Map() }}>{node}</SWRConfig>);

describe("content calendar", () => {
    it("shows scheduled posts on their day, unscheduled drafts below, and the stage mix", () => {
        const html = render(<ContentCalendarPage />, {
            [LIST_KEY]: {
                posts: [post({}), post({ id: "post-2", funnelStage: "BOFU", status: "IN_REVIEW", body: "Doors close Friday" })],
                unscheduled: [post({ id: "post-3", scheduledAt: null, body: "Idea: behind the scenes" })],
            },
            [ACCOUNTS_KEY]: { accounts: [account] },
            [MIX_KEY]: { target: { TOFU: 60, MOFU: 30, BOFU: 10, POST: 0 } },
        });

        expect(html).toContain("Content calendar");
        expect(html).toContain("Three mistakes new founders make");
        expect(html).toContain("Doors close Friday");
        expect(html).toContain("Waiting for approval");
        expect(html).toContain("No time yet");
        expect(html).toContain("Idea: behind the scenes");
        expect(html).toContain("2 posts in view");
        expect(html).toContain('draggable="true"');
    });

    it("points to Social accounts when nothing is connected", () => {
        const html = render(<ContentCalendarPage />, {
            [LIST_KEY]: { posts: [], unscheduled: [] },
            [ACCOUNTS_KEY]: { accounts: [] },
        });
        expect(html).toContain("Connect an account first");
        expect(html).toContain('href="/settings/social"');
    });

    it("compares the mix in view with the target", () => {
        const html = render(<StageMixMeter posts={[post({}), post({ id: "b", funnelStage: "BOFU" })]} />, {
            [MIX_KEY]: { target: { TOFU: 60, MOFU: 30, BOFU: 10, POST: 0 } },
        });
        expect(html).toContain("50% of 60%");
        expect(html).toContain("50% of 10%");
        expect(html).toContain("0% of 30%");
        expect(html).toContain("Change target");
    });
});
