import { describe, expect, it, vi } from "vitest";
import { handleAPIError } from "./apiResponse";
import { PiiMaskingError } from "@/lib/ai/piiMask";

describe("handleAPIError - personal-data masking failure (DPDP)", () => {
    it("shows the person why the AI request was not sent, instead of a generic server error", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const res = handleAPIError(new PiiMaskingError());
        const body = await res.json();
        expect(res.status).toBe(422);
        expect(body.code).toBe("PII_MASKING_FAILED");
        expect(body.error).toMatch(/not sent/i);
    });
});
