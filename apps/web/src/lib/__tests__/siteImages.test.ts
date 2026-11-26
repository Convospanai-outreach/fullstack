import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import homeJson from "../../../content/settings/home.json";
import { buildDecapConfig } from "../decapCms";
import { cleanImagePath, STEP_IMAGE } from "../siteImages";

const PUBLIC_DIR = path.resolve(__dirname, "../../../public");
type StepImage = { desktop?: string; mobile?: string; alt?: string };

// What a CMS pull request must satisfy before it can be merged: every image path is a real upload, has the
// right shape (a larger file of the same shape is fine) and comes with a description.
async function problemsWith(images: StepImage[], publicDir: string): Promise<string[]> {
    const problems: string[] = [];
    for (const [i, img] of images.entries()) {
        const where = `step ${i + 1}`;
        const desktop = img.desktop ?? "";
        const mobile = img.mobile ?? "";
        if (!desktop && !mobile) continue;
        if (!desktop) problems.push(`${where}: a mobile image needs a desktop image too`);
        if (!(img.alt ?? "").trim()) problems.push(`${where}: add a description (alt text) for the image`);
        for (const [kind, value] of [["desktop", desktop], ["mobile", mobile]] as const) {
            if (!value) continue;
            if (!cleanImagePath(value)) { problems.push(`${where} ${kind}: "${value}" is not a JPG, PNG, WebP or AVIF in /uploads`); continue; }
            const file = path.join(publicDir, value);
            if (!fs.existsSync(file)) { problems.push(`${where} ${kind}: ${value} was not uploaded`); continue; }
            const { width = 0, height = 0 } = await sharp(file).metadata();
            const want = STEP_IMAGE[kind];
            const ratioOff = Math.abs(width / height - want.width / want.height) / (want.width / want.height);
            if (ratioOff > 0.02) problems.push(`${where} ${kind}: ${width}x${height} is the wrong shape, export ${want.width}x${want.height}`);
            else if (width < want.width) problems.push(`${where} ${kind}: ${width}px wide is too small, export ${want.width}x${want.height}`);
        }
    }
    return problems;
}

describe("cleanImagePath", () => {
    it("accepts only uploads the CMS writes", () => {
        expect(cleanImagePath("/uploads/step-1.jpg")).toBe("/uploads/step-1.jpg");
        expect(cleanImagePath(" /uploads/Step_2.WEBP ")).toBe("/uploads/Step_2.WEBP");
        for (const bad of ["", undefined, 5, "uploads/a.jpg", "/uploads/a.gif", "/uploads/../secret.jpg", "/uploads/sub/a.jpg", "//evil.com/a.jpg", "https://x.com/a.jpg", "/images/a.jpg", "javascript:alert(1)"]) {
            expect(cleanImagePath(bad)).toBe("");
        }
    });
});

describe("home step images", () => {
    it("the shipped home.json image fields are valid (this is the check a CMS pull request must pass)", async () => {
        expect(await problemsWith(homeJson.workflow.steps.map((s) => s.image), PUBLIC_DIR)).toEqual([]);
    });

    it("catches a missing file, a wrong shape, a small file, a missing description and a bad path", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "step-images-"));
        fs.mkdirSync(path.join(dir, "uploads"));
        const make = (name: string, width: number, height: number) =>
            sharp({ create: { width, height, channels: 3, background: "#888" } }).jpeg().toFile(path.join(dir, "uploads", name));
        await make("good-d.jpg", 1200, 1000);
        await make("good-m.jpg", 900, 675);
        await make("retina-d.jpg", 2400, 2000);
        await make("square.jpg", 1000, 1000);
        await make("tiny.jpg", 600, 500);
        try {
            expect(await problemsWith([{ desktop: "/uploads/good-d.jpg", mobile: "/uploads/good-m.jpg", alt: "Maya at her desk" }, { desktop: "/uploads/retina-d.jpg", alt: "x" }, {}], dir)).toEqual([]);
            const bad = await problemsWith([
                { desktop: "/uploads/gone.jpg", alt: "x" },
                { desktop: "/uploads/square.jpg", alt: "x" },
                { desktop: "/uploads/tiny.jpg", alt: "x" },
                { desktop: "/uploads/good-d.jpg", mobile: "/uploads/good-d.jpg", alt: "x" },
                { desktop: "/uploads/good-d.jpg" },
                { desktop: "https://x.com/a.jpg", alt: "x" },
                { mobile: "/uploads/good-m.jpg", alt: "x" },
            ], dir);
            expect(bad).toEqual([
                "step 1 desktop: /uploads/gone.jpg was not uploaded",
                "step 2 desktop: 1000x1000 is the wrong shape, export 1200x1000",
                "step 3 desktop: 600px wide is too small, export 1200x1000",
                "step 4 mobile: 1200x1000 is the wrong shape, export 900x675",
                "step 5: add a description (alt text) for the image",
                "step 6 desktop: \"https://x.com/a.jpg\" is not a JPG, PNG, WebP or AVIF in /uploads",
                "step 7: a mobile image needs a desktop image too",
            ]);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("CMS config for step images", () => {
    it("offers separate desktop and mobile uploads that cannot point off-site", () => {
        const config = buildDecapConfig("https://example.com");
        expect(config).toContain("media_folder: apps/site/public/uploads");
        expect(config).toContain("public_folder: /uploads");
        expect(config).toMatch(/name: desktop, widget: image, required: false, choose_url: false/);
        expect(config).toMatch(/name: mobile, widget: image, required: false, choose_url: false/);
        expect(config).toContain(`${STEP_IMAGE.desktop.width} x ${STEP_IMAGE.desktop.height}`);
        expect(config).toContain(`${STEP_IMAGE.mobile.width} x ${STEP_IMAGE.mobile.height}`);
    });
});
