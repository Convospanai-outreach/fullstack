import { describe, expect, it } from "vitest";
import * as api from "../../../api/src/lib/crm/linkedin";
import * as web from "@/lib/crm/linkedin";

// apps/web/src/lib/crm/linkedin.ts mirrors apps/api/src/lib/crm/linkedin.ts. The expected
// values are also what migration 20261020120000_extension_lead_pipeline's UPDATE produces.
const cases: [unknown, string | null][] = [
    ["http://www.linkedin.com/in/jane-doe", "https://www.linkedin.com/in/jane-doe/"],
    ["https://www.linkedin.com/in/jane-doe/", "https://www.linkedin.com/in/jane-doe/"],
    ["https://in.linkedin.com/in/Jane-Doe-12ab/?originalSubdomain=in", "https://www.linkedin.com/in/jane-doe-12ab/"],
    ["linkedin.com/in/jane-doe#about", "https://www.linkedin.com/in/jane-doe/"],
    ["  https://linkedin.com/in/jos%c3%a9-r/details/experience/ ", "https://www.linkedin.com/in/jos%c3%a9-r/"],
    ["https://www.linkedin.com/company/acme/", null],
    ["https://evil.example/linkedin.com/in/jane", null],
    ["", null],
    [null, null],
    [42, null],
];

describe("LinkedIn profile URL form", () => {
    it.each(cases)("%s", (input, expected) => {
        expect(api.canonicalLinkedInProfileUrl(input)).toBe(expected);
        expect(web.canonicalLinkedInProfileUrl(input)).toBe(expected);
        expect(web.linkedInHandle(input)).toBe(api.linkedInHandle(input));
    });

    it("keeps non-profile values as given, trimmed, for storage", () => {
        for (const helper of [api, web]) {
            expect(helper.linkedInForStorage(" https://www.linkedin.com/company/acme ")).toBe("https://www.linkedin.com/company/acme");
            expect(helper.linkedInForStorage("http://www.linkedin.com/in/jane-doe")).toBe("https://www.linkedin.com/in/jane-doe/");
            expect(helper.linkedInForStorage(null)).toBeNull();
            expect(helper.linkedInForStorage(undefined)).toBeUndefined();
        }
    });
});
