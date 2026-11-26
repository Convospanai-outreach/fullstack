// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InboxPlacementCard from "@/components/mailboxes/InboxPlacementCard";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const pass = { dkim: "pass", aligned: true, spf: "pass", dmarc: "pass" };
const done = (level: "green" | "amber" | "red", results: unknown[], acceptedAt: string | null = null) => ({
    state: { status: "done", checkedAt: "2026-11-25T10:00:00Z", contentSource: "campaign", sent: results.length, error: null, acceptedAt, results },
    verdict: { level, reasons: [level === "red" ? "Gmail put the email in spam." : "No placement or authentication problem found at the test inboxes."] },
});

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;

async function render() {
    await act(async () => { root.render(<InboxPlacementCard mailboxId="m1" />); });
    await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
});

describe("InboxPlacementCard", () => {
    it("shows a green result with the folder and authentication per provider", async () => {
        fetchMock.mockResolvedValue(json(200, done("green", [
            { provider: "gmail", folder: "inbox", auth: pass, error: null },
            { provider: "yahoo", folder: "inbox", auth: pass, error: null },
        ])));
        await render();
        expect(container.textContent).toContain("No problems found");
        expect(container.textContent).toContain("Gmail");
        expect(container.textContent).toContain("DKIM pass, SPF pass, DMARC pass");
        expect(container.textContent).not.toContain("Accept result");
    });

    it("offers Accept result on red and sends { accept: true } after confirmation", async () => {
        fetchMock.mockResolvedValueOnce(json(200, done("red", [{ provider: "gmail", folder: "spam", auth: pass, error: null }])));
        fetchMock.mockResolvedValueOnce(json(200, { ...done("amber", [{ provider: "gmail", folder: "spam", auth: pass, error: null }], "2026-11-25T11:00:00Z") }));
        vi.spyOn(window, "confirm").mockReturnValue(true);
        await render();
        expect(container.textContent).toContain("Problem found");
        expect(container.textContent).toContain("Spam");

        const accept = [...container.querySelectorAll("button")].find((b) => b.textContent === "Accept result")!;
        await act(async () => { accept.click(); });
        const [url, init] = fetchMock.mock.calls[1]!;
        expect(String(url)).toContain("/mailboxes/m1/placement-check");
        expect(init).toMatchObject({ method: "PATCH", body: JSON.stringify({ accept: true }) });
        expect(container.textContent).not.toContain("Accept result");
    });

    it("shows the server's error when a check cannot start", async () => {
        fetchMock.mockResolvedValueOnce(json(200, { state: null, verdict: { level: "amber", reasons: ["No inbox placement check has run yet."] } }));
        fetchMock.mockResolvedValueOnce(json(503, { error: "No test inboxes are set up yet.", code: "NO_TEST_INBOXES" }));
        await render();
        const run = [...container.querySelectorAll("button")].find((b) => b.textContent === "Run check")!;
        await act(async () => { run.click(); });
        expect(fetchMock.mock.calls[1]![1]).toMatchObject({ method: "POST" });
        expect(container.querySelector("[role=alert]")?.textContent).toBe("No test inboxes are set up yet.");
    });
});
