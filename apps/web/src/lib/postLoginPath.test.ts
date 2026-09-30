import { describe, expect, it } from "vitest";
import { postLoginPath } from "./postLoginPath";

describe("postLoginPath", () => {
    it("lands on Home", () => {
        expect(postLoginPath()).toBe("/dashboard");
    });
});
