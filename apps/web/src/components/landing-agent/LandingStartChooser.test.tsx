// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingStartChooser from "./LandingStartChooser";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Smoke test of the two choices and the gallery's cards. The logic is covered in landingTemplateGallery.test.ts.
describe("LandingStartChooser", () => {
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

    it("offers the template choice and the AI choice", () => {
        act(() => root.render(<LandingStartChooser />));
        const titles = Array.from(container.querySelectorAll("button h2")).map((h) => h.textContent);
        expect(titles).toEqual(["Start from a template", "Write it with AI"]);
    });

    it("opens the gallery with one card per template when the template choice is picked", () => {
        act(() => root.render(<LandingStartChooser />));
        const templateChoice = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Start from a template"));
        act(() => templateChoice?.click());

        const useButtons = Array.from(container.querySelectorAll("button")).filter((b) => b.textContent === "Use this template");
        expect(useButtons).toHaveLength(11);
        expect(container.querySelector("#template-page-name")).not.toBeNull();
    });

    it("refuses to create a page without a name and says why", () => {
        act(() => root.render(<LandingStartChooser />));
        act(() => Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Start from a template"))?.click());
        act(() => Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Use this template")?.click());

        expect(container.querySelector('[role="alert"]')?.textContent).toBe("Give the page a name.");
    });
});
