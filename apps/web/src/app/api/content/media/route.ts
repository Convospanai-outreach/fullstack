import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { resolveEnabledFeatureKeys } from "@/lib/hiddenFeaturesReadiness";
import { uploadPublicFile } from "@/lib/supabaseStorage";

export const dynamic = "force-dynamic";

// Creator funnel: an image for a calendar post. Instagram fetches post media from a public URL
// at publish time, so it goes to the public `content-media` bucket under the team's folder with
// an unguessable name (apps/api only accepts URLs of this shape, see isOwnMediaUrl).
// Instagram rules, checked 2026-09-30 at
// https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media:
// "JPEG" only, "8 MB maximum". The 4:5 to 1.91:1 aspect ratio is checked in the browser.
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!(await resolveEnabledFeatureKeys(teamId)).has("creator-funnel")) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided. Use form field "file".' }, { status: 400 });
        if (file.size > MAX_BYTES) return NextResponse.json({ error: "Images can be at most 8 MB." }, { status: 413 });

        // The browser's content type is only a claim; check the JPEG signature too.
        const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
        if (file.type !== "image/jpeg" || head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
            return NextResponse.json({ error: "Only JPEG images work on Instagram. Save the image as .jpg and try again." }, { status: 400 });
        }

        const folder = teamId.replace(/[^a-zA-Z0-9_-]/g, "");
        const { url } = await uploadPublicFile("content-media", `${folder}/${crypto.randomUUID()}.jpg`, file);
        return NextResponse.json({ url });
    } catch (error: any) {
        console.error("[content:media:post]", error);
        return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
    }
}
