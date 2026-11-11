import { describe, expect, it } from "vitest";
import { serializeTabularData } from "./toonCore";

describe("serializeTabularData", () => {
    it("writes rows of plain values unchanged", () => {
        expect(serializeTabularData([{ a: "x", b: 2 }])).toBe('[a,b]("x",2)');
    });

    it("escapes quotes and backslashes inside a string so a value cannot end its own field", () => {
        const out = serializeTabularData([{ a: 'say "hi"', b: "c:\\d" }]);
        expect(out).toBe('[a,b]("say \\"hi\\"","c:\\\\d")');
    });
});
