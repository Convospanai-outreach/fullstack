import { describe, expect, it } from "vitest";
import { jsonLdScript } from "@/lib/jsonLd";

describe("jsonLdScript", () => {
    it("cannot be closed early by a stored value", () => {
        const out = jsonLdScript({ name: "</script><script>alert(1)</script>", d: "<!-- x" });

        expect(out).not.toContain("<");
        expect(out).not.toContain(">");
    });

    it("still parses back to the same data", () => {
        const data = { name: "a </script> b & c \u2028", n: 1 };

        expect(JSON.parse(jsonLdScript(data))).toEqual(data);
    });
});
