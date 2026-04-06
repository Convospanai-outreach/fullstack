import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContext } from "@/lib/auth";
import { buildStudioPresentationBuffer } from "@/modules/studio/presentationDeck";
import { normalizeStudioConfig } from "@/modules/studio/presentation";

export const runtime = "nodejs";

const studioPresentationSchema = z.object({
    config: z.unknown(),
    preview: z.string().optional(),
});

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = studioPresentationSchema.parse(await req.json());
        const config = normalizeStudioConfig(body.config);
        const { buffer, fileName } = await buildStudioPresentationBuffer(config, body.preview);
        const responseBody = new Uint8Array(buffer);

        return new NextResponse(responseBody, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
        }

        console.error("Failed to generate studio presentation", error);
        return NextResponse.json({ error: "Failed to generate presentation" }, { status: 500 });
    }
}
