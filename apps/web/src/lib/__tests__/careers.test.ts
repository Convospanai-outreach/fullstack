import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getJobBySlug, getJobs } from "../careers";

describe("job openings", () => {
    let dir: string;
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "jobs-"));
    });
    afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

    const write = (name: string, text: string) => fs.writeFileSync(path.join(dir, name), text);

    it("reads each opening's details and its description", () => {
        write("sdr.md", "---\ntitle: Sales Development Rep\nlocation: Gurugram\ntype: Full time\ndepartment: Sales\nopen: true\norder: 1\n---\n\nYou will book meetings.\n");

        expect(getJobs(dir)).toEqual([
            { slug: "sdr", title: "Sales Development Rep", location: "Gurugram", type: "Full time", department: "Sales", open: true, order: 1, description: "You will book meetings." },
        ]);
    });

    it("lists only open positions unless asked for all, ordered by order then title", () => {
        write("b.md", "---\ntitle: Bravo\nopen: true\norder: 2\n---\nb");
        write("a.md", "---\ntitle: Alpha\nopen: true\norder: 2\n---\na");
        write("c.md", "---\ntitle: Charlie\nopen: true\norder: 1\n---\nc");
        write("closed.md", "---\ntitle: Closed\nopen: false\n---\nx");
        write("no-title.md", "---\nopen: true\n---\nx");

        expect(getJobs(dir).map((j) => j.title)).toEqual(["Charlie", "Alpha", "Bravo"]);
        expect(getJobs(dir, { includeClosed: true }).map((j) => j.title)).toContain("Closed");
    });

    it("finds an open position by slug and does not find a closed or missing one", () => {
        write("open.md", "---\ntitle: Open\nopen: true\n---\nx");
        write("closed.md", "---\ntitle: Closed\nopen: false\n---\nx");

        expect(getJobBySlug("open", dir)?.title).toBe("Open");
        expect(getJobBySlug("closed", dir)).toBeUndefined();
        expect(getJobBySlug("../open", dir)).toBeUndefined();
        expect(getJobBySlug("nothing", dir)).toBeUndefined();
    });

    it("ignores a file whose name is not a plain slug, so it can never become part of a link", () => {
        write("ok-job.md", "---\ntitle: Fine\nopen: true\n---\nx");
        write("bad name.md", "---\ntitle: Space\nopen: true\n---\nx");
        write("a'onclick=x.md", "---\ntitle: Quote\nopen: true\n---\nx");

        expect(getJobs(dir).map((j) => j.slug)).toEqual(["ok-job"]);
    });

    it("is empty when the folder is missing", () => {
        expect(getJobs(path.join(dir, "missing"))).toEqual([]);
    });
});
