import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const { mockConnectMicrosoftMailbox } = vi.hoisted(() => ({
    mockConnectMicrosoftMailbox: vi.fn(),
}));

vi.mock("@/modules/email-campaigner/service/microsoftMailboxService", () => ({
    connectMicrosoftMailbox: mockConnectMicrosoftMailbox,
}));
vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({
    sanitizeRelativePath: (p?: string | null) => (p && p.startsWith("/") ? p : "/settings/mailboxes"),
}));

function getRequest(params: Record<string, string>) {
    const url = new URL("http://localhost/api/integrations/microsoft/oauth/callback");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return { nextUrl: url } as unknown as NextRequest;
}

describe("GET /api/integrations/microsoft/oauth/callback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects a callback with no state param without ever resolving a mailbox", async () => {
        const { GET } = await import("./route");

        const res = await GET(getRequest({ code: "auth-code" }));

        expect(res.status).toBe(302);
        expect(mockConnectMicrosoftMailbox).not.toHaveBeenCalled();
        const location = res.headers.get("location")!;
        expect(location).toContain("connected=false");
    });

    it("delegates to connectMicrosoftMailbox with the caller-supplied code/state and redirects on success", async () => {
        mockConnectMicrosoftMailbox.mockResolvedValue({ mailbox: { email: "user@company.com" }, nextPath: "/settings/mailboxes" });
        const { GET } = await import("./route");

        const res = await GET(getRequest({ code: "auth-code", state: "signed-state" }));

        expect(mockConnectMicrosoftMailbox).toHaveBeenCalledWith({ code: "auth-code", state: "signed-state" });
        expect(res.status).toBe(302);
        const location = res.headers.get("location")!;
        expect(location).toContain("connected=true");
    });

    it("redirects with an error and never attaches a mailbox when state verification fails", async () => {
        mockConnectMicrosoftMailbox.mockRejectedValue(new Error("Invalid OAuth state signature."));
        const { GET } = await import("./route");

        const res = await GET(getRequest({ code: "auth-code", state: "tampered" }));

        expect(res.status).toBe(302);
        const location = res.headers.get("location")!;
        expect(location).toContain("connected=false");
    });
});
