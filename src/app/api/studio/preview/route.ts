import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { generateResponse } from "@/ai/ragEngine";
import { studioPreviewSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();

        // Validate input
        const validated = studioPreviewSchema.parse(body);

        const response = await generateResponse(
            validated.context || "",
            validated.mission || "",
            validated.config
        );

        return NextResponse.json({ response });
    } catch (error: any) {
        if (error.name === "ZodError") {
            return NextResponse.json({
                error: "Validation failed",
                details: error.errors
            }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
