import { renderToStaticMarkup } from "react-dom/server";
import { SWRConfig } from "swr";
import { describe, expect, it } from "vitest";
import { HomeOverview } from "@/components/dashboard/HomeOverview";

const stages = [{ stage: "COLD", count: 4 }];
const render = (channels: unknown[]) =>
    renderToStaticMarkup(
        <SWRConfig value={{ fallback: { "/api/dashboard/overview": { stages, channels, record: [] } }, provider: () => new Map() }}>
            <HomeOverview />
        </SWRConfig>,
    );

describe("Home: calls row", () => {
    it("shows logged calls and conversations with the share of calls that became one", () => {
        const html = render([{ channel: "email", sent: 10, replies: 2 }, { channel: "call", sent: 4, replies: 1 }]);
        expect(html).toContain("Logged calls");
        expect(html).toContain("1 conversation<");
        expect(html).toContain("25%");
    });

    it("says what will appear and links to the next step when no call is logged", () => {
        const html = render([{ channel: "email", sent: 10, replies: 2 }, { channel: "call", sent: 0, replies: 0 }]);
        expect(html).toContain("No calls logged yet");
        expect(html).toContain('href="/leads"');
    });
});
