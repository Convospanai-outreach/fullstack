import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTestimonials } from "../testimonials";

describe("getTestimonials", () => {
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "testimonials-"));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    const write = (name: string, text: string) => fs.writeFileSync(path.join(dir, name), text);

    it("reads each entry's person, role, company and quote", () => {
        write("jane.md", '---\nname: Jane Roe\nrole: Head of Sales\ncompany: Acme\norder: 1\n---\n\nIt cut our review time in half.\n');

        expect(getTestimonials(dir)).toEqual([
            { slug: "jane", name: "Jane Roe", role: "Head of Sales", company: "Acme", quote: "It cut our review time in half.", order: 1 },
        ]);
    });

    it("lists by order, then name, and leaves out entries missing a name or a quote", () => {
        write("b.md", "---\nname: Bea\norder: 2\n---\nSecond\n");
        write("a.md", "---\nname: Al\norder: 2\n---\nAlso second\n");
        write("c.md", "---\nname: Cy\norder: 1\n---\nFirst\n");
        write("no-name.md", "---\norder: 0\n---\nNobody said this\n");
        write("no-quote.md", "---\nname: Quiet\n---\n");
        write("notes.txt", "ignored");

        expect(getTestimonials(dir).map((t) => t.name)).toEqual(["Cy", "Al", "Bea"]);
    });

    it("is empty when the folder is missing or has no entries, so the site shows nothing", () => {
        expect(getTestimonials(path.join(dir, "missing"))).toEqual([]);
        expect(getTestimonials(dir)).toEqual([]);
    });
});
