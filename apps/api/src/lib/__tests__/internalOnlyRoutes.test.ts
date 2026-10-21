import { describe, expect, it } from "vitest";
import { isInternalOnlyRoute } from "../internalOnlyRoutes";

describe("isInternalOnlyRoute", () => {
    it.each(["/email/send-verification", "/email/verification-token", "/email/verify-token"])("%s is internal only", (path) => {
        expect(isInternalOnlyRoute(path)).toBe(true);
    });

    it.each(["/email/send", "/email/unsubscribe", "/email/send-verification-other", "/leads"])("%s is not", (path) => {
        expect(isInternalOnlyRoute(path)).toBe(false);
    });
});
