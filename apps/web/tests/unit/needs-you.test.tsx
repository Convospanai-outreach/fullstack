import { renderToStaticMarkup } from "react-dom/server";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import { NeedsYou } from "@/components/dashboard/NeedsYou";

const KEY = "/api/proxy/dashboard/needs-you";
const at = "2026-09-30T05:30:00.000Z";

const empty = (type: string, href: string) => ({ type, count: 0, top: [], href });
const allEmpty = [
    empty("unread_replies", "/inbox"),
    empty("approvals", "/inbox?tab=approvals"),
    empty("approved_not_sent", "/campaigns"),
    empty("stalled_leads", "/inbox?tab=approvals"),
    empty("mailbox_issues", "/settings/mailboxes"),
    empty("meetings_today", "/calendar"),
];

function render(needsYou: unknown, hasLeads = true) {
    return renderToStaticMarkup(
        <SWRConfig value={{ fallback: { [KEY]: needsYou === undefined ? undefined : { needsYou } }, provider: () => new Map() }}>
            <NeedsYou hasLeads={hasLeads} />
        </SWRConfig>,
    );
}

describe("Home: Needs you", () => {
    it("says all clear with one next step when nothing is waiting", () => {
        const withLeads = render(allEmpty, true);
        expect(withLeads).toContain("All clear");
        expect(withLeads).toContain('href="/campaigns/new"');

        const noLeads = render(allEmpty, false);
        expect(noLeads).toContain('href="/leads/import"');
    });

    it("shows only the items that have something waiting, each linking to the exact thing", () => {
        const html = render([
            { type: "unread_replies", count: 5, href: "/inbox", top: [{ id: "m1", title: "Asha", detail: "Tuesday works", href: "/inbox?reply=m1", at }] },
            ...allEmpty.slice(1),
        ]);

        expect(html).toContain("Replies to answer");
        expect(html).toContain('href="/inbox?reply=m1"');
        expect(html).toContain("See all 5");
        expect(html).not.toContain("Meetings today");
        expect(html).not.toContain("All clear");
    });

    it("offers inline approve only on approvals", () => {
        const html = render([
            { type: "approvals", count: 1, href: "/inbox?tab=approvals", top: [{ id: "a1", title: "Email Draft Approval", detail: "Intro", href: "/inbox?tab=approvals", at }] },
            { type: "mailbox_issues", count: 1, href: "/settings/mailboxes", top: [{ id: "mb1", title: "sales@acme.test", detail: null, href: "/settings/mailboxes", at: null }] },
        ]);

        expect(html.match(/>Approve</g)).toHaveLength(1);
        expect(html).toContain("Mailboxes to reconnect");
        expect(html).not.toContain("See all");
    });

    it("renders nothing while the API has no answer, so an outage never reads as all clear", () => {
        expect(render(undefined)).toBe("");
    });
});
