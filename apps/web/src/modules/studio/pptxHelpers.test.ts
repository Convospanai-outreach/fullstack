import { describe, expect, it } from "vitest";
import { svgToDataUri } from "./pptxHelpers";

const decode = (uri: string) => Buffer.from(uri.split(",")[1]!, "base64").toString("utf8");

describe("svgToDataUri", () => {
    it("drops the XML declaration and adds the namespace", () => {
        const svg = decode(svgToDataUri('<?xml version="1.0"?><svg viewBox="0 0 1 1"><path fill="currentColor"/></svg>'));
        expect(svg).not.toContain("<?xml");
        expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" viewBox');
        expect(svg).toContain("#0f172a");
    });

    it("stays fast on many unterminated declarations", () => {
        const start = performance.now();
        svgToDataUri("<?xml".repeat(40_000));
        expect(performance.now() - start).toBeLessThan(500);
    });
});
