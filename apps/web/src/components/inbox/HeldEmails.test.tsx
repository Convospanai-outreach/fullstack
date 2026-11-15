// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeldEmails, type HeldEmail } from "./HeldEmails";

const item = (over: Partial<HeldEmail> = {}): HeldEmail => ({
    runId: "r1",
    leadId: "l1",
    leadName: null,
    email: "a@x.test",
    company: "Acme",
    campaignName: "Launch",
    sequenceName: "Intro",
    subject: "Quick question",
    heldAt: new Date().toISOString(),
    missing: [{ token: "firstName", reason: "empty", suggestedFallback: "there", advice: "Write {{firstName|there}} in the step." }],
    canApprove: true,
    ...over,
});

let container: HTMLDivElement;
let root: Root;
const onApprove = vi.fn();
const onRetry = vi.fn();

async function render(items: HeldEmail[], total?: number) {
    await act(async () => {
        root.render(<HeldEmails items={items} total={total} onApprove={onApprove} onRetry={onRetry} />);
    });
}

const button = (label: string) => Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes(label)) as HTMLButtonElement;

beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    onApprove.mockResolvedValue(undefined);
    onRetry.mockResolvedValue(undefined);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

describe("HeldEmails", () => {
    it("says nothing is waiting when the list is empty", async () => {
        await render([]);
        expect(container.textContent).toContain("No emails are waiting");
    });

    it("shows which field is missing and the suggested fix, and approves on click", async () => {
        await render([item()]);

        expect(container.textContent).toContain("{{firstName}}");
        expect(container.textContent).toContain("is empty for this contact");
        expect(container.textContent).toContain("Write {{firstName|there}} in the step.");

        await act(async () => {
            button("Approve and send").click();
        });
        expect(onApprove).toHaveBeenCalledWith("r1");
    });

    it("blocks approval when a field has no fallback, but still lets the sender check again", async () => {
        await render([
            item({
                canApprove: false,
                missing: [{ token: "firstNam", reason: "unknown", suggestedFallback: null, advice: 'Did you mean {{firstName}}?' }],
            }),
        ]);

        expect(container.textContent).toContain("is not a known field");
        expect(button("Approve and send").disabled).toBe(true);
        expect(container.textContent).toContain("Cannot send as is");

        await act(async () => {
            button("check again").click();
        });
        expect(onRetry).toHaveBeenCalledWith("r1");
    });

    it("shows why an approval failed", async () => {
        onApprove.mockRejectedValue(new Error("These fields have no fallback"));
        await render([item()]);
        await act(async () => {
            button("Approve and send").click();
        });
        expect(container.textContent).toContain("These fields have no fallback");
    });

    it("says so when the list is cut off, and not otherwise", async () => {
        await render([item()], 240);
        expect(container.textContent).toContain("Showing the newest 1 of 240 held emails");
        await render([item()], 1);
        expect(container.textContent).not.toContain("Showing the newest");
    });
});
