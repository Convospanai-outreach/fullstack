import { describe, expect, it } from "vitest";
import * as api from "../../../api/src/lib/utm";
import * as web from "@/lib/utm";

// apps/web/src/lib/utm.ts mirrors apps/api/src/lib/utm.ts (apps/web can't import apps/api):
// the two must tag links and read UTM the same way.
describe("UTM helper", () => {
    const cases: [string, api.Utm][] = [
        ["https://craftmyfunnel.live/p/guide?t=abc#form", { source: "instagram", medium: "comment", campaign: "trig-1", content: "post-1" }],
        ["https://craftmyfunnel.live/p/guide?utm_source=mine", { source: "email", medium: "sequence", campaign: "c-1" }],
        ["https://x.example/a b?q=1", { source: "facebook", medium: "dm", campaign: null }],
        ["mailto:a@b.co", { source: "email", medium: "sequence" }],
        ["/p/relative", { source: "email", medium: "sequence" }],
    ];

    it("tags links without overwriting the creator's own UTM, keeping other params and the fragment", () => {
        expect(api.withUtm(cases[0]![0], cases[0]![1])).toBe(
            "https://craftmyfunnel.live/p/guide?t=abc&utm_source=instagram&utm_medium=comment&utm_campaign=trig-1&utm_content=post-1#form",
        );
        expect(api.withUtm(cases[1]![0], cases[1]![1])).toBe("https://craftmyfunnel.live/p/guide?utm_source=mine&utm_medium=sequence&utm_campaign=c-1");
        expect(api.withUtm("mailto:a@b.co", cases[3]![1])).toBe("mailto:a@b.co");
        expect(api.withUtm("/p/relative", cases[4]![1])).toBe("/p/relative");
    });

    it("reads UTM trimmed and capped", () => {
        const params = new URLSearchParams({ utm_source: " ig ", utm_content: "x".repeat(300), utm_medium: "" });
        expect(api.readUtm(params)).toEqual({ utmSource: "ig", utmMedium: undefined, utmCampaign: undefined, utmTerm: undefined, utmContent: "x".repeat(200) });
    });

    it("web and api behave the same", () => {
        for (const [url, utm] of cases) expect(web.withUtm(url, utm)).toBe(api.withUtm(url, utm));
        const params = new URLSearchParams("utm_source=a&utm_medium=b&utm_campaign=c&utm_term=d&utm_content=e");
        expect(web.readUtm(params)).toEqual(api.readUtm(params));
    });
});
