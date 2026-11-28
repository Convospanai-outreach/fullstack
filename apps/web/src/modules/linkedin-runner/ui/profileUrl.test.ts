import { describe, expect, it } from "vitest";
import { toRunnerProfileUrl } from "./profileUrl";

describe("toRunnerProfileUrl", () => {
    it.each([
        ["https://www.linkedin.com/in/asha-rao", "https://www.linkedin.com/in/asha-rao"],
        ["linkedin.com/in/asha-rao/", "https://www.linkedin.com/in/asha-rao"],
        ["  https://in.linkedin.com/in/asha-rao?utm=x  ", "https://www.linkedin.com/in/asha-rao"],
    ])("accepts %s", (input, expected) => {
        expect(toRunnerProfileUrl(input)).toBe(expected);
    });

    it.each([
        "",
        "asha-rao",
        "https://linkedin.com/company/acme",
        "https://linkedin.com/in/",
        "https://evil-linkedin.com/in/asha",
        "https://linkedin.com.evil.test/in/asha",
        "javascript:alert(1)",
    ])("rejects %j", (input) => {
        expect(toRunnerProfileUrl(input)).toBeNull();
    });
});
