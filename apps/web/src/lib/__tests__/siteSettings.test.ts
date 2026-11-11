import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGa4MeasurementId } from "../siteSettings";

describe("getGa4MeasurementId", () => {
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "settings-"));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    const file = (value: unknown) => {
        const p = path.join(dir, "analytics.json");
        fs.writeFileSync(p, typeof value === "string" ? value : JSON.stringify(value));
        return p;
    };

    it("is the Google Analytics 4 ID an editor set", () => {
        expect(getGa4MeasurementId(file({ ga4MeasurementId: "G-ABC123XYZ9" }))).toBe("G-ABC123XYZ9");
        expect(getGa4MeasurementId(file({ ga4MeasurementId: "  g-abc123xyz9 " }))).toBe("G-ABC123XYZ9");
    });

    it.each([
        ["empty", ""],
        ["not a GA4 ID", "UA-12345-1"],
        ["script text", 'G-AB"><script>alert(1)</script>'],
        ["too long", "G-" + "A".repeat(40)],
    ])("is undefined when the value is %s, so the site falls back to its own setting", (_label, value) => {
        expect(getGa4MeasurementId(file({ ga4MeasurementId: value }))).toBeUndefined();
    });

    it("is undefined for a missing or broken file", () => {
        expect(getGa4MeasurementId(path.join(dir, "missing.json"))).toBeUndefined();
        expect(getGa4MeasurementId(file("{ not json"))).toBeUndefined();
    });
});
