// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DmFlowPreview } from "@/components/content/DmFlowPreview";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

async function render(props: Parameters<typeof DmFlowPreview>[0]) {
    await act(async () => {
        root.render(<DmFlowPreview {...props} />);
    });
}

describe("DmFlowPreview", () => {
    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it("shows each step as a chat bubble, in order, with the person's answer after a question", async () => {
        await render({
            properties: [{ key: "budget", label: "Budget" }],
            steps: [
                { type: "message", text: "Thanks for asking!", property: "" },
                { type: "question", text: "What is your budget?", property: "budget" },
                { type: "message", text: "Great, here you go.", property: "" },
                { type: "end", text: "", property: "" },
            ],
        });
        const bubbles = Array.from(container.querySelectorAll("[data-bubble]")).map(
            (el) => `${el.getAttribute("data-bubble")}:${el.textContent?.trim()}`
        );
        expect(bubbles).toEqual([
            "from-us:Thanks for asking!",
            "from-us:What is your budget?",
            "from-person:Their answer is saved to Budget",
            "from-us:Great, here you go.",
            "end:Flow ends",
        ]);
    });

    it("shows a landing link as a plain label, not a live link", async () => {
        await render({ properties: [], steps: [{ type: "link", text: "Here is the guide", property: "" }] });
        expect(container.textContent).toContain("Here is the guide");
        expect(container.textContent).toContain("[landing page link]");
        expect(container.querySelector("a")).toBeNull();
    });

    it("renders the text as text, never as markup", async () => {
        await render({ properties: [], steps: [{ type: "message", text: '<img src=x onerror="alert(1)"><b>hi</b>', property: "" }] });
        expect(container.querySelector("img")).toBeNull();
        expect(container.querySelector("b")).toBeNull();
        expect(container.textContent).toContain('<img src=x onerror="alert(1)"><b>hi</b>');
    });

    it("says there is nothing to preview for an empty flow", async () => {
        await render({ properties: [], steps: [] });
        expect(container.textContent).toContain("Add a step to see the conversation here.");
    });
});
