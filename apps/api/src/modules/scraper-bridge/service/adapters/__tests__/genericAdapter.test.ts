import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetPage, mockGoto } = vi.hoisted(() => ({ mockGetPage: vi.fn(), mockGoto: vi.fn() }));
vi.mock("@/modules/scraper-bridge/service/browserManager", () => ({ browserManager: { getPage: mockGetPage } }));
vi.mock("@/modules/scraper-bridge/service/safeNavigation", () => ({ gotoPublicUrl: mockGoto }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn() } }));

import { GenericAdapter } from "../genericAdapter";

describe("GenericAdapter", () => {
    const page = {
        waitForNetworkIdle: vi.fn(),
        content: vi.fn(),
        close: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetPage.mockResolvedValue(page);
        mockGoto.mockResolvedValue(undefined);
        page.content.mockResolvedValue("<html>ok</html>");
    });

    it("waits for the load event, not network idle", async () => {
        page.waitForNetworkIdle.mockResolvedValue(undefined);
        await new GenericAdapter().scrape("https://example.com/");
        expect(mockGoto).toHaveBeenCalledWith(page, "https://example.com/", { waitUntil: "load" });
    });

    it("still returns content when the page never goes idle", async () => {
        page.waitForNetworkIdle.mockRejectedValue(new Error("Timeout"));
        await expect(new GenericAdapter().scrape("https://example.com/")).resolves.toEqual({ content: "<html>ok</html>" });
        expect(page.close).toHaveBeenCalled();
    });
});
