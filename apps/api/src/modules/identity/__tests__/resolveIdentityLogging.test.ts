import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLogger, reIdentify } = vi.hoisted(() => ({
    mockLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    reIdentify: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));
vi.mock("@/services/HardwareService", () => ({ HardwareService: { reIdentify } }));

import { IdentityService } from "../IdentityService";

const TOKEN = "[EMAIL_0123456789ab]";

describe("IdentityService.resolveIdentity logging", () => {
    beforeEach(() => vi.clearAllMocks());

    it("audits each access with a token hash, never the token", async () => {
        reIdentify.mockResolvedValue({ email: "jane@example.com" });
        await IdentityService.resolveIdentity(TOKEN, "reply_draft", "team-1");
        await IdentityService.resolveIdentity(TOKEN, "reply_draft", "team-1");

        const lines = mockLogger.info.mock.calls.map((call) => String(call[0]));
        expect(lines.join("\n")).not.toContain("0123456789ab");
        expect(lines.join("\n")).not.toContain("jane@example.com");
        // Same token, same reference, so the audit trail still correlates.
        const refs = lines.filter((line) => line.includes("Access Request")).map((line) => line.match(/token ([0-9a-f]{12})/)?.[1]);
        expect(refs).toHaveLength(2);
        expect(refs[0]).toBeDefined();
        expect(refs[0]).toBe(refs[1]);
    });
});
