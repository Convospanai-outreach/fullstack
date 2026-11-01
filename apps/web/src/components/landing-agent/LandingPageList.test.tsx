// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockListCampaigns, mockCreateFromTemplate, mockSetPageSlug } = vi.hoisted(() => ({
    mockListCampaigns: vi.fn(),
    mockCreateFromTemplate: vi.fn(),
    mockSetPageSlug: vi.fn(),
}));
vi.mock("@/modules/landing-agent/service/landingAgentApi", () => ({
    landingAgentApi: { listCampaigns: mockListCampaigns, createCampaignFromTemplate: mockCreateFromTemplate, setPageSlug: mockSetPageSlug },
}));

import LandingPageList from "./LandingPageList";

const campaign = (autoReplies: { total: number; active: number } | undefined) => ({
    id: "campaign-1",
    name: "Free guide",
    updatedAt: "2026-10-30T10:00:00Z",
    pages: [{ id: "page-1", slug: "guide", title: "Free guide", status: "published", updatedAt: "2026-10-30T10:00:00Z", autoReplies }],
    _count: { wireframeOptions: 0, leads: 2 },
});

async function renderList(container: HTMLDivElement, root: Root) {
    await act(async () => {
        root.render(<LandingPageList />);
    });
    await act(async () => {});
}

describe("LandingPageList auto-reply usage", () => {
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
        mockListCampaigns.mockReset();
    });

    it("shows how many keyword auto-replies link to each page", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [campaign({ total: 3, active: 1 })], liveDomain: null });

        await renderList(container, root);

        expect(container.textContent).toContain("Used by 3 auto-replies");
    });

    it("uses the singular for one auto-reply", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [campaign({ total: 1, active: 1 })], liveDomain: null });

        await renderList(container, root);

        expect(container.textContent).toContain("Used by 1 auto-reply");
        expect(container.textContent).not.toContain("Used by 1 auto-replies");
    });

    it("says no auto-reply uses the page when the count is zero", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [campaign({ total: 0, active: 0 })], liveDomain: null });

        await renderList(container, root);

        expect(container.textContent).toContain("Used by 0 auto-replies");
    });
});

const publishedGuide = {
    id: "campaign-2",
    name: "Free guide",
    updatedAt: "2026-10-30T10:00:00Z",
    pages: [{ id: "page-2", slug: "guide", title: "Free guide", status: "published", updatedAt: "2026-10-30T10:00:00Z", autoReplies: undefined }],
    _count: { wireframeOptions: 0, leads: 0 },
};

const draftPage = {
    id: "campaign-3",
    name: "Draft offer",
    updatedAt: "2026-10-30T10:00:00Z",
    pages: [{ id: "page-3", slug: "draft-offer", title: "Draft offer", status: "draft", updatedAt: "2026-10-30T10:00:00Z", autoReplies: undefined }],
    _count: { wireframeOptions: 0, leads: 0 },
};

// React reads the value from the element's own setter, so set it that way and fire the change event.
function setFieldValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
    const isSelect = el instanceof HTMLSelectElement;
    const proto = isSelect ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event(isSelect ? "change" : "input", { bubbles: true }));
}

function buttonWithText(container: HTMLElement, text: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === text);
    if (!button) throw new Error(`no button "${text}"`);
    return button as HTMLButtonElement;
}

function linkWithText(container: HTMLElement, text: string): HTMLAnchorElement | undefined {
    return Array.from(container.querySelectorAll("a")).find((a) => a.textContent === text) as HTMLAnchorElement | undefined;
}

describe("LandingPageList addresses, domains and new pages", () => {
    let container: HTMLDivElement;
    let root: Root;
    let clipboardWrite: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
        clipboardWrite = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: clipboardWrite } });
        mockCreateFromTemplate.mockReset();
        mockSetPageSlug.mockReset();
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        mockListCampaigns.mockReset();
    });

    it("shows the published page on the team's first domain and links it there", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [publishedGuide], liveDomain: "yourbrand.com", domains: ["yourbrand.com", "go.yourbrand.com"] });

        await renderList(container, root);

        expect(container.textContent).toContain("yourbrand.com/guide");
        expect(linkWithText(container, "View live")?.getAttribute("href")).toBe("https://yourbrand.com/guide");
    });

    it("switches the shown domain for the page link and the copy button", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [publishedGuide], liveDomain: "yourbrand.com", domains: ["yourbrand.com", "go.yourbrand.com"] });
        await renderList(container, root);

        const picker = container.querySelector<HTMLSelectElement>('select[aria-label="Domain"]')!;
        await act(async () => setFieldValue(picker, "go.yourbrand.com"));

        expect(container.textContent).toContain("go.yourbrand.com/guide");
        expect(linkWithText(container, "View live")?.getAttribute("href")).toBe("https://go.yourbrand.com/guide");
        await act(async () => buttonWithText(container, "Copy link").click());
        expect(clipboardWrite).toHaveBeenCalledWith("https://go.yourbrand.com/guide");
    });

    it("falls back to the app's /p address and shows no domain picker without an active domain", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [publishedGuide], liveDomain: null, domains: [] });

        await renderList(container, root);

        expect(container.querySelector('select[aria-label="Domain"]')).toBeNull();
        expect(linkWithText(container, "View live")?.getAttribute("href")).toBe("/p/guide");
    });

    it("creates a draft at the typed path from the chosen template", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [], liveDomain: null, domains: [] });
        mockCreateFromTemplate.mockResolvedValue({ campaignId: "c-new", pageId: "p-new" });
        await renderList(container, root);

        await act(async () => setFieldValue(container.querySelector<HTMLInputElement>('input[aria-label="New page path"]')!, "spring-guide"));
        await act(async () => buttonWithText(container, "Create draft").click());

        expect(mockCreateFromTemplate).toHaveBeenCalledWith(expect.objectContaining({ path: "spring-guide", templateId: expect.any(String) }));
    });

    it("says the address is taken when another page already uses it", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [], liveDomain: null, domains: [] });
        mockCreateFromTemplate.mockRejectedValue(new Error("This web address is taken. Try another."));
        await renderList(container, root);

        await act(async () => setFieldValue(container.querySelector<HTMLInputElement>('input[aria-label="New page path"]')!, "spring-guide"));
        await act(async () => buttonWithText(container, "Create draft").click());

        expect(container.textContent).toContain("This web address is taken. Try another.");
    });

    it("rejects an invalid path before calling the server", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [], liveDomain: null, domains: [] });
        await renderList(container, root);

        await act(async () => setFieldValue(container.querySelector<HTMLInputElement>('input[aria-label="New page path"]')!, "Spring Guide!"));
        await act(async () => buttonWithText(container, "Create draft").click());

        expect(mockCreateFromTemplate).not.toHaveBeenCalled();
        expect(container.textContent).toContain("Use 2 to 63 letters, numbers or hyphens");
    });

    it("lets the user change the address of a draft page", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [draftPage], liveDomain: null, domains: [] });
        mockSetPageSlug.mockResolvedValue({ id: "page-3", slug: "spring-guide" });
        await renderList(container, root);

        await act(async () => buttonWithText(container, "Change address").click());
        await act(async () => setFieldValue(container.querySelector<HTMLInputElement>('input[aria-label="Page path"]')!, "spring-guide"));
        await act(async () => buttonWithText(container, "Save address").click());

        expect(mockSetPageSlug).toHaveBeenCalledWith("campaign-3", "page-3", "spring-guide");
    });

    it("does not offer to change the address of a published page", async () => {
        mockListCampaigns.mockResolvedValue({ campaigns: [publishedGuide], liveDomain: null, domains: [] });

        await renderList(container, root);

        expect(Array.from(container.querySelectorAll("button")).some((b) => b.textContent === "Change address")).toBe(false);
    });
});
