import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);

export async function POST(req: NextRequest) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { checkTeamPermission, TeamRole } = await import("@/lib/permissions");
        const isAdmin = await checkTeamPermission(userId, teamId, TeamRole.ADMIN);
        if (!isAdmin) {
            return NextResponse.json({ error: "Forbidden: Admin permissions required to upload branding logo" }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided. Use form field "file".' }, { status: 400 });
        }

        if (!ALLOWED_TYPES.has(file.type)) {
            return NextResponse.json({ error: "Only PNG, JPEG, WebP, or SVG images are accepted." }, { status: 400 });
        }

        if (file.size > MAX_LOGO_SIZE) {
            return NextResponse.json(
                { error: `File too large. Maximum size is ${MAX_LOGO_SIZE / (1024 * 1024)}MB.` },
                { status: 413 }
            );
        }

        const MIME_TO_EXT: Record<string, string> = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/webp": ".webp",
            "image/svg+xml": ".svg",
        };
        const ext = MIME_TO_EXT[file.type] || ".png";
        const sanitizedTeamId = teamId.replace(/[^a-zA-Z0-9_-]/g, "");
        const blob = await put(`branding/${sanitizedTeamId}/logo-${Date.now()}${ext}`, file, {
            access: "public",
            addRandomSuffix: false,
        });

        return NextResponse.json({ ok: true, url: blob.url });
    } catch (error: any) {
        console.error("[settings:branding:logo:post]", error);
        return NextResponse.json({ error: error?.message || "Upload failed" }, { status: 500 });
    }
}
