// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import LandingPageList from "@/components/landing-agent/LandingPageList";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let root: Root;
let container: HTMLDivElement;
const fetchMock = vi.fn();

async function render() {
    await act(async () => {
        root.render(<LandingPageList />);
    });
    for (let i = 0; i < 3; i++) await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
}

const campaign = (over: Record<string, unknown>) => ({
    id: "lc-1",
    name: "Spring launch",
    updatedAt: "2026-10-10T10:00:00.000Z",
    pages: [],
    _count: { wireframeOptions: 0, leads: 0 },
    ...over,
});

describe("LandingPageList", () => {
    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    it("links each landing page to the step it can be picked up at", async () => {
        fetchMock.mockResolvedValue(
            json(200, {
                campaigns: [
                    campaign({
                        id: "lc-live",
                        pages: [{ slug: "spring", title: "Spring guide", status: "published", updatedAt: "2026-10-11T10:00:00.000Z" }],
                        _count: { wireframeOptions: 3, leads: 2 },
                    }),
                    campaign({ id: "lc-draft", pages: [{ slug: "draft", title: null, status: "draft", updatedAt: "2026-10-11T10:00:00.000Z" }] }),
                    campaign({ id: "lc-layouts", _count: { wireframeOptions: 3, leads: 0 } }),
                    campaign({ id: "lc-new" }),
                ],
            })
        );
        await render();

        expect(fetchMock.mock.calls[0]![0]).toBe("/api/proxy/landing-agent/campaigns");
        expect(container.querySelector('a[href="/landing-agent/lc-live/editor"]')?.textContent).toBe("Edit");
        expect(container.querySelector('a[href="/p/spring"]')?.textContent).toBe("View live");
        expect(container.textContent).toContain("Spring guide");
        expect(container.textContent).toContain("Published · 2 sign-ups");
        // A draft has an editor link but no live link.
        expect(container.querySelector('a[href="/landing-agent/lc-draft/editor"]')).toBeTruthy();
        expect(container.querySelector('a[href="/p/draft"]')).toBeNull();
        expect(container.querySelector('a[href="/landing-agent/lc-layouts/wireframes"]')?.textContent).toBe("Pick a layout");
        expect(container.querySelector('a[href="/landing-agent/lc-new/brief"]')?.textContent).toBe("Continue");
    });

    it("sends View live to the team's connected domain when there is one", async () => {
        fetchMock.mockResolvedValue(
            json(200, {
                campaigns: [campaign({ pages: [{ slug: "spring", title: null, status: "published", updatedAt: "2026-10-11T10:00:00.000Z" }] })],
                liveDomain: "go.example.com",
            })
        );
        await render();

        expect(container.querySelector('a[href="https://go.example.com/spring"]')?.textContent).toBe("View live");
        expect(container.querySelector('a[href="/p/spring"]')).toBeNull();
    });

    it("says so when there are no landing pages, and still offers a new one", async () => {
        fetchMock.mockResolvedValue(json(200, { campaigns: [] }));
        await render();

        expect(container.textContent).toContain("No landing pages yet.");
        expect(container.querySelector('a[href="/landing-agent/new"]')).toBeTruthy();
    });

    it("shows the error when the list can't be loaded", async () => {
        fetchMock.mockResolvedValue(json(500, { error: "Database is down" }));
        await render();

        expect(container.textContent).toContain("Database is down");
    });
});
