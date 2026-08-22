import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { settingsService } from "@/modules/settings/service/settingsService";

export async function POST(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();

    // Validate? (e.g. check if keys look valid)

    try {
        await settingsService.updateSettings(userId, data);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return new NextResponse((error as Error).message, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const settings = await settingsService.getSettings(userId);

    // Mask keys for security?
    const masked = { ...settings };
    if (masked.apiKeyOpenAI) masked.apiKeyOpenAI = "sk-..." + masked.apiKeyOpenAI.slice(-4);
    if (masked.apiKeyGemini) masked.apiKeyGemini = "AI..." + masked.apiKeyGemini.slice(-4);

    return NextResponse.json(masked);
}
