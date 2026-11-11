import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CITIES_MATRIX, getLocationBySlug, loadLocations } from "../locations";

const city = (slug: string, order: number, extra: Record<string, unknown> = {}) => ({
    slug, name: slug.toUpperCase(), state: "S", stateCode: "IN-S", placename: "p", position: "1;2", icbm: "1, 2",
    latitude: "1", longitude: "2", corridors: ["a"], industryFocus: ["b"], summary: "sum", order, ...extra,
});

describe("loadLocations", () => {
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "locations-"));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
    const write = (file: string, value: unknown) => fs.writeFileSync(path.join(dir, file), typeof value === "string" ? value : JSON.stringify(value));

    it("lists locations by their order field and does not expose it", () => {
        write("b.json", city("b", 2));
        write("a.json", city("a", 1));

        const result = loadLocations(dir);

        expect(result.map((l) => l.slug)).toEqual(["a", "b"]);
        expect(result[0]).not.toHaveProperty("order");
        expect(result[0]!.corridors).toEqual(["a"]);
    });

    it("skips a file that is not valid or is missing a field the pages need, rather than breaking the site", () => {
        write("good.json", city("good", 1));
        write("broken.json", "{ not json");
        write("no-name.json", city("x", 2, { name: "" }));
        write("bad-list.json", city("y", 3, { corridors: "not a list" }));
        write("readme.txt", "ignored");

        expect(loadLocations(dir).map((l) => l.slug)).toEqual(["good"]);
    });

    it("is empty when the folder is missing", () => {
        expect(loadLocations(path.join(dir, "missing"))).toEqual([]);
    });
});

describe("the site's locations", () => {
    it("has the ten hubs, each findable by slug, with unique slugs", () => {
        expect(CITIES_MATRIX).toHaveLength(10);
        expect(new Set(CITIES_MATRIX.map((c) => c.slug)).size).toBe(10);
        expect(getLocationBySlug("gurugram")?.name).toBe("Gurugram");
        expect(getLocationBySlug("nowhere")).toBeUndefined();
    });
});
