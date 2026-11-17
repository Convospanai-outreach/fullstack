import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SWRConfig } from "swr";
import { EdgeStatusPlate } from "@/components/dashboard/EdgeStatusPlate";
import { EdgeStatusChip } from "@/components/dashboard/EdgeStatusChip";
import { EDGE_STATUS_KEY } from "@/components/dashboard/useEdgeStatus";
import type { EdgeHeartbeat } from "@/lib/edgeHeartbeat";

vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}));

function render(node: React.ReactNode, edge?: EdgeHeartbeat) {
    const fallback = edge ? { [EDGE_STATUS_KEY]: edge } : {};
    return renderToStaticMarkup(<SWRConfig value={{ fallback, provider: () => new Map() }}>{node}</SWRConfig>);
}

const recent = new Date(Date.now() - 5 * 60_000).toISOString();

describe("EdgeStatusPlate", () => {
    it("renders nothing until the status has loaded", () => {
        expect(render(<EdgeStatusPlate />)).toBe("");
    });

    it("invites pairing when no node is paired, linking to /edge", () => {
        const html = render(<EdgeStatusPlate />, { configured: false });
        expect(html).toContain("Pair a node to keep personal data on your own device");
        expect(html).toContain('href="/edge"');
    });

    it.each([
        ["green", "Edge connected"],
        ["amber", "Edge heartbeat stale"],
        ["red", "Edge offline"],
    ] as const)("shows %s status with last heartbeat", (state, label) => {
        const html = render(<EdgeStatusPlate />, { configured: true, state, lastSeenAt: recent });
        expect(html).toContain(label);
        expect(html).toContain("Last heartbeat 5m ago");
        expect(html).toContain('href="/edge"');
    });

    it("shares data with the header chip (same key, no second source)", () => {
        const edge: EdgeHeartbeat = { configured: true, state: "green", lastSeenAt: recent };
        const html = render(<><EdgeStatusChip /><EdgeStatusPlate /></>, edge);
        expect(html.match(/Edge connected/g)?.length).toBeGreaterThanOrEqual(2);
    });
});
