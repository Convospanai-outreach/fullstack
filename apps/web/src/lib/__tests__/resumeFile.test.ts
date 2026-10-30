import { describe, expect, it } from "vitest";
import { MAX_RESUME_BYTES, checkResume } from "../resumeFile";

const pdf = Buffer.from("%PDF-1.7\n...");
const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("rest")]);
const doc = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.from("rest")]);

describe("checkResume", () => {
    it("accepts a PDF, a DOCX and a DOC whose contents match their names", () => {
        expect(checkResume("cv.pdf", pdf)).toEqual({ ok: true, type: "application/pdf" });
        expect(checkResume("CV.DOCX", docx)).toEqual({ ok: true, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        expect(checkResume("cv.doc", doc)).toEqual({ ok: true, type: "application/msword" });
    });

    it("refuses other file types, however they are named", () => {
        expect(checkResume("run.exe", Buffer.from("MZ"))).toMatchObject({ ok: false });
        expect(checkResume("page.html", Buffer.from("<html>"))).toMatchObject({ ok: false });
        expect(checkResume("cv", pdf)).toMatchObject({ ok: false });
    });

    it("refuses a file whose contents do not match its extension", () => {
        expect(checkResume("cv.pdf", Buffer.from("<script>alert(1)</script>"))).toMatchObject({ ok: false });
        expect(checkResume("cv.docx", pdf)).toMatchObject({ ok: false });
        expect(checkResume("cv.doc", docx)).toMatchObject({ ok: false });
    });

    it("refuses an empty file and one over the size limit", () => {
        expect(checkResume("cv.pdf", Buffer.alloc(0))).toMatchObject({ ok: false });
        const big = Buffer.concat([pdf, Buffer.alloc(MAX_RESUME_BYTES)]);
        expect(checkResume("cv.pdf", big)).toMatchObject({ ok: false });
    });
});
