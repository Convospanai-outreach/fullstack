import { describe, expect, it } from "vitest";

import { MAX_LANDING_IMAGE_BYTES, checkLandingImageUpload, detectLandingImageFormat } from "./imageUpload";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const WEBP_HEADER = [...Buffer.from("RIFF"), 0x24, 0x00, 0x00, 0x00, ...Buffer.from("WEBP")];

function withPadding(header: number[], size = 64): Uint8Array {
    const out = new Uint8Array(size);
    out.set(header, 0);
    return out;
}

describe("detectLandingImageFormat", () => {
    it("recognises PNG, JPG and WebP by their leading bytes", () => {
        expect(detectLandingImageFormat(withPadding(PNG_HEADER))).toEqual({ extension: "png", contentType: "image/png" });
        expect(detectLandingImageFormat(withPadding(JPG_HEADER))).toEqual({ extension: "jpg", contentType: "image/jpeg" });
        expect(detectLandingImageFormat(withPadding(WEBP_HEADER))).toEqual({ extension: "webp", contentType: "image/webp" });
    });

    it("rejects a RIFF container that is not WebP (e.g. WAV)", () => {
        const wav = withPadding([...Buffer.from("RIFF"), 0x24, 0, 0, 0, ...Buffer.from("WAVE")]);
        expect(detectLandingImageFormat(wav)).toBeNull();
    });

    it("rejects GIF, PDF, SVG and plain text", () => {
        expect(detectLandingImageFormat(Buffer.from("GIF89a....."))).toBeNull();
        expect(detectLandingImageFormat(Buffer.from("%PDF-1.7 ....."))).toBeNull();
        expect(detectLandingImageFormat(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
        expect(detectLandingImageFormat(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    });

    it("rejects a truncated PNG header", () => {
        expect(detectLandingImageFormat(new Uint8Array(PNG_HEADER.slice(0, 4)))).toBeNull();
    });
});

describe("checkLandingImageUpload", () => {
    it("accepts a real PNG", () => {
        expect(checkLandingImageUpload(withPadding(PNG_HEADER))).toMatchObject({ ok: true });
    });

    it("accepts a file exactly at the 2 MB limit", () => {
        const bytes = withPadding(JPG_HEADER, MAX_LANDING_IMAGE_BYTES);
        expect(checkLandingImageUpload(bytes)).toMatchObject({ ok: true });
    });

    it("rejects an empty file with 400", () => {
        expect(checkLandingImageUpload(new Uint8Array(0))).toMatchObject({ ok: false, status: 400 });
    });

    it("rejects a file over 2 MB with 413, even if the header is valid", () => {
        const bytes = withPadding(PNG_HEADER, MAX_LANDING_IMAGE_BYTES + 1);
        expect(checkLandingImageUpload(bytes)).toMatchObject({ ok: false, status: 413 });
    });

    it("rejects wrong magic bytes with 415 (a text file named .png)", () => {
        expect(checkLandingImageUpload(Buffer.from("not really a picture, just text"))).toMatchObject({ ok: false, status: 415 });
    });

    it("rejects a wrong type with 415 (a GIF)", () => {
        expect(checkLandingImageUpload(Buffer.from("GIF89a" + "x".repeat(20)))).toMatchObject({ ok: false, status: 415 });
    });
});
