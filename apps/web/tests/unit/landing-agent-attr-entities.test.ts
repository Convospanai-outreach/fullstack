import { describe, expect, it } from "vitest";
import { getLandingRenderPayload } from "@/modules/landing-agent/rendering";

// roadmap 3.3 (S-09): /p/[slug] now receives renderedJson.html already cleaned by
// the API's sanitize-html, which serializes `&` inside attributes as `&amp;`. This
// copy re-escaped every `&`, turning that into `&amp;amp;` and breaking UTM links
// and CDN image URLs. Existing character references must pass through once.
describe("landing html attribute entities (API -> web composition)", () => {
    const render = (html: string) => getLandingRenderPayload({ html, css: "" }).html;

    it("keeps an already-encoded query string intact", () => {
        const html = render(
            '<a href="https://x.test/?utm_source=a&amp;utm_medium=b" title="Tom &amp; Jerry">x</a>' +
                '<img src="https://cdn.test/i.png?w=1&amp;h=2" alt="a &quot;b&quot;">'
        );
        expect(html).toContain('href="https://x.test/?utm_source=a&amp;utm_medium=b"');
        expect(html).toContain('title="Tom &amp; Jerry"');
        expect(html).toContain('src="https://cdn.test/i.png?w=1&amp;h=2"');
        expect(html).toContain('alt="a &quot;b&quot;"');
        expect(html).not.toContain("&amp;amp;");
    });

    // Exact shape the API's sanitize-html emits: `<`/`>` encoded in attributes, void
    // elements written as ` />`.
    it("passes the API's sanitize-html output through without double-encoding", () => {
        const html = render(
            '<a href="https://x.test/?utm_source=a&amp;utm_medium=b" title="a&lt;b&gt;c">x</a>' +
                '<img src="https://cdn.test/i.png?w=1&amp;h=2" alt="hero" />'
        );
        expect(html).toContain('href="https://x.test/?utm_source=a&amp;utm_medium=b"');
        expect(html).toContain('title="a&lt;b&gt;c"');
        expect(html).toContain('src="https://cdn.test/i.png?w=1&amp;h=2"');
        expect(html).not.toContain("&amp;amp;");
        expect(html).not.toContain("&amp;lt;");
    });

    it("still encodes a bare ampersand from raw editor html", () => {
        expect(render('<a href="https://x.test/?a=1&b=2">x</a>')).toContain('href="https://x.test/?a=1&amp;b=2"');
    });

    it("still drops an entity-encoded javascript: href", () => {
        const html = render('<a href="jav&#x61;script:alert(1)">x</a><a href="&#106;avascript:alert(1)">y</a>');
        expect(html).not.toContain("href=");
    });
});
