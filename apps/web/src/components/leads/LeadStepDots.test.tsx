// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LeadStepDots, type LeadStepSummary } from "./LeadStepDots";

const step = (key: string, label: string, state: LeadStepSummary["state"], detail: string | null = null): LeadStepSummary => ({ key, label, state, detail });

describe("LeadStepDots", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it("draws one dot per step and names the first step that is not done", () => {
        act(() => {
            root.render(
                <LeadStepDots
                    steps={[
                        step("signal", "Signal Review", "done"),
                        step("draft", "Draft Prep", "done"),
                        step("channel", "Channel Connect", "done", "2 emails sent"),
                        step("reply", "Reply Track", "active", "Waiting for a reply"),
                        step("approve", "Approve Action", "todo"),
                        step("advance", "Advance Lead", "todo"),
                    ]}
                />
            );
        });
        expect(container.querySelectorAll("li")).toHaveLength(6);
        expect(container.textContent).toContain("Reply Track · in progress");
        expect(container.querySelectorAll("li")[2].getAttribute("title")).toBe("Channel Connect: 2 emails sent");
    });

    it("says so when a rejected approval blocks the lead", () => {
        act(() => {
            root.render(<LeadStepDots steps={[step("signal", "Signal Review", "done"), step("approve", "Approve Action", "blocked", "Rejected")]} />);
        });
        expect(container.textContent).toContain("Approve Action · blocked");
    });

    it("reports a finished lead", () => {
        act(() => {
            root.render(<LeadStepDots steps={[step("signal", "Signal Review", "done")]} />);
        });
        expect(container.textContent).toContain("All steps done");
    });
});
