import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPage, gotoPublicUrl, page } = vi.hoisted(() => {
    const page = { evaluate: vi.fn().mockResolvedValue({ name: "Ada" }), close: vi.fn().mockResolvedValue(undefined) };
    return { getPage: vi.fn().mockResolvedValue(page), gotoPublicUrl: vi.fn().mockResolvedValue(undefined), page };
});

vi.mock("@/modules/scraper-bridge/service/browserManager", () => ({ browserManager: { getPage, getBrowser: vi.fn() } }));
vi.mock("@/modules/scraper-bridge/service/safeNavigation", () => ({ gotoPublicUrl }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { runLinkedInAction } from "../puppeteerRunner";

describe("runLinkedInAction profile URL", () => {
    beforeEach(() => vi.clearAllMocks());

    it.each([
        "https://attacker.example/in/ada",
        "http://169.254.169.254/latest/meta-data",
        "https://www.linkedin.com.attacker.example/in/ada",
        "https://www.linkedin.com/company/acme",
        "",
        undefined,
    ])("does not open %s", async (profileUrl) => {
        const result = await runLinkedInAction({ action: "scrape", profileUrl });

        expect(result.ok).toBe(false);
        expect(getPage).not.toHaveBeenCalled();
        expect(gotoPublicUrl).not.toHaveBeenCalled();
    });

    it("opens a profile URL in its canonical form", async () => {
        const result = await runLinkedInAction({ action: "scrape", profileUrl: "http://in.linkedin.com/in/Ada-Lovelace?trk=x" });

        expect(result.ok).toBe(true);
        expect(gotoPublicUrl).toHaveBeenCalledWith(page, "https://www.linkedin.com/in/ada-lovelace/", { waitUntil: "networkidle2" });
    });
});
