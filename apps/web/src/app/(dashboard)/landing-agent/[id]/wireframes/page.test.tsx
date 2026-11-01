// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockApi, mockPush } = vi.hoisted(() => ({
    mockApi: { getCampaign: vi.fn(), selectWireframe: vi.fn(), generateWireframes: vi.fn() },
    mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "lc-1" }), useRouter: () => ({ push: mockPush }) }));
vi.mock("@/modules/landing-agent/service/landingAgentApi", () => ({ landingAgentApi: mockApi }));

import LandingAgentWireframesPage from "./page";

const campaign = {
    id: "lc-1",
    name: "Spring Guide",
    selectedWireframeId: null,
    pages: [],
    wireframeOptions: [{ id: "wf-1", title: "Direct offer", framework: "AIDA", description: "", structure: [] }],
};

describe("wireframe selection with a web address", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockApi.getCampaign.mockResolvedValue(campaign);
        mockApi.selectWireframe.mockResolvedValue({ id: "lp-1" });
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => root.render(<LandingAgentWireframesPage />));
        await act(async () => {});
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    function pathInput(): HTMLInputElement | null {
        return container.querySelector<HTMLInputElement>('input[aria-label="Web address"]');
    }

    function selectButton(): HTMLButtonElement | undefined {
        return Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Select & Open Editor");
    }

    it("offers a web address field before the first page exists", () => {
        expect(pathInput()).not.toBeNull();
    });

    it("sends the typed address with the selection", async () => {
        act(() => {
            const input = pathInput()!;
            const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
            setValue.call(input, "spring-offer");
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });

        await act(async () => selectButton()?.click());

        expect(mockApi.selectWireframe).toHaveBeenCalledWith("lc-1", "wf-1", "spring-offer");
    });

    it("sends no address when the field is left empty, so the address is generated", async () => {
        await act(async () => selectButton()?.click());

        expect(mockApi.selectWireframe).toHaveBeenCalledWith("lc-1", "wf-1", undefined);
    });

    it("refuses a malformed address and does not select", async () => {
        act(() => {
            const input = pathInput()!;
            const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
            setValue.call(input, "a");
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });

        await act(async () => selectButton()?.click());

        expect(mockApi.selectWireframe).not.toHaveBeenCalled();
        expect(container.textContent).toContain("Use 2 to 63 letters, numbers or hyphens");
    });
});
