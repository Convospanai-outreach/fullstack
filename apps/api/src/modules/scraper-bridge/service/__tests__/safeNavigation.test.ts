import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAssertSafe } = vi.hoisted(() => ({ mockAssertSafe: vi.fn() }));
vi.mock("@/modules/webhooks/service/webhookService", () => ({ assertSafeWebhookUrl: mockAssertSafe }));

import { gotoPublicUrl } from "../safeNavigation";

function fakePage() {
    let handler: ((request: any) => void) | undefined;
    const page = {
        setRequestInterception: vi.fn().mockResolvedValue(undefined),
        on: vi.fn((_event: string, cb: (request: any) => void) => {
            handler = cb;
        }),
        goto: vi.fn().mockResolvedValue("response"),
    };
    const request = (url: string) => {
        const req = { url: () => url, continue: vi.fn(), abort: vi.fn() };
        handler!(req);
        return req;
    };
    return { page, request };
}

describe("gotoPublicUrl", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAssertSafe.mockImplementation(async (url: string) => {
            if (!/^https?:/.test(url)) throw new Error("Webhook URL protocol is not allowed");
            if (/localhost|169\.254|10\./.test(url)) throw new Error("Webhook URL resolves to a non-public address");
        });
    });

    it("never navigates to a URL the guard rejects", async () => {
        const { page } = fakePage();

        await expect(gotoPublicUrl(page, "http://169.254.169.254/latest/meta-data/")).rejects.toThrow("non-public");

        expect(page.goto).not.toHaveBeenCalled();
        expect(page.setRequestInterception).not.toHaveBeenCalled();
    });

    it("navigates to a public URL and lets its requests through", async () => {
        const { page, request } = fakePage();

        await expect(gotoPublicUrl(page, "https://example.com/", { waitUntil: "networkidle2" })).resolves.toBe("response");
        const req = request("https://example.com/app.js");
        await vi.waitFor(() => expect(req.continue).toHaveBeenCalled());

        expect(page.setRequestInterception).toHaveBeenCalledWith(true);
        expect(page.goto).toHaveBeenCalledWith("https://example.com/", { waitUntil: "networkidle2" });
        expect(req.abort).not.toHaveBeenCalled();
    });

    it("aborts a redirect or subrequest that points at an internal address", async () => {
        const { page, request } = fakePage();
        await gotoPublicUrl(page, "https://example.com/");

        const redirect = request("http://localhost:3001/admin");
        const metadata = request("http://169.254.169.254/latest/meta-data/");
        const file = request("file:///etc/passwd");
        await vi.waitFor(() => {
            expect(redirect.abort).toHaveBeenCalledWith("blockedbyclient");
            expect(metadata.abort).toHaveBeenCalledWith("blockedbyclient");
            expect(file.abort).toHaveBeenCalled();
        });

        expect(redirect.continue).not.toHaveBeenCalled();
        expect(metadata.continue).not.toHaveBeenCalled();
    });

    it("lets inline data: URLs through without a lookup", async () => {
        const { page, request } = fakePage();
        await gotoPublicUrl(page, "https://example.com/");
        mockAssertSafe.mockClear();

        const inline = request("data:image/png;base64,AAAA");

        expect(inline.continue).toHaveBeenCalled();
        expect(mockAssertSafe).not.toHaveBeenCalled();
    });

    it("checks each host once per page", async () => {
        const { page, request } = fakePage();
        await gotoPublicUrl(page, "https://example.com/");
        mockAssertSafe.mockClear();

        const a = request("https://cdn.example.net/a.js");
        const b = request("https://cdn.example.net/b.js");
        await vi.waitFor(() => {
            expect(a.continue).toHaveBeenCalled();
            expect(b.continue).toHaveBeenCalled();
        });

        expect(mockAssertSafe).toHaveBeenCalledTimes(1);
    });
});
