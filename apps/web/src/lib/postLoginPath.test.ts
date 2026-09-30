import { afterEach, describe, expect, it, vi } from "vitest";
import { postLoginPath } from "./postLoginPath";

describe("postLoginPath", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("lands on the Action Inbox by default", () => {
        vi.stubEnv("NEXT_PUBLIC_ACTION_INBOX_ENABLED", "");
        expect(postLoginPath()).toBe("/inbox");
    });

    it("rolls back to the dashboard when the flag is \"false\"", () => {
        vi.stubEnv("NEXT_PUBLIC_ACTION_INBOX_ENABLED", "false");
        expect(postLoginPath()).toBe("/dashboard");
    });
});
