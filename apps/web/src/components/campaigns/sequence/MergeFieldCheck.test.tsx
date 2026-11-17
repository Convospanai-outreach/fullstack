// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MergeFieldCheck from "./MergeFieldCheck";

let container: HTMLDivElement;
let root: Root;

const reply = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => body });

async function renderWith(fetchMock: ReturnType<typeof vi.fn>) {
    vi.stubGlobal("fetch", fetchMock);
    await act(async () => {
        root.render(<MergeFieldCheck campaignId="c1" />);
    });
    await act(async () => {
        await Promise.resolve();
    });
}

beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe("MergeFieldCheck", () => {
    it("lists each missing field with how many contacts and the advice", async () => {
        const fetchMock = reply({
            leadsChecked: 10,
            truncated: false,
            steps: [
                {
                    stepId: "s1",
                    stepOrder: 1,
                    subject: "Hi {{firstName}}",
                    contactsHeld: 4,
                    issues: [{ token: "firstName", reason: "empty", suggestedFallback: "there", advice: "Add a fallback such as {{firstName|there}}.", leadsAffected: 4, sampleLeads: [{ id: "a", name: "Asha", email: null }] }],
                },
            ],
        });

        await renderWith(fetchMock);

        expect(container.textContent).toContain("4 of 10 contacts would be held");
        expect(container.textContent).toContain("{{firstName}}");
        expect(container.textContent).toContain("Add a fallback such as");
        expect(String(fetchMock.mock.calls[0]![0])).toContain("precheck?campaignId=c1");
    });

    it("says everything is filled when there are no issues", async () => {
        await renderWith(reply({ leadsChecked: 3, truncated: false, steps: [{ stepId: "s1", stepOrder: 1, subject: "Hello", contactsHeld: 0, issues: [] }] }));
        expect(container.textContent).toContain("Every merge field is filled for all 3 contacts");
    });

    it("shows the server error", async () => {
        await renderWith(reply({ error: "Campaign not found" }, false));
        expect(container.textContent).toContain("Campaign not found");
    });
});
