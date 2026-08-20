import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: Request) {
    const { teamId } = await getCurrentContext();
    if (!teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    if (!slug) {
        return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    revalidatePath(`/p/${slug}`);

    return NextResponse.json({ ok: true });
}
