import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { step, data } = body;

        if (!step || !data) {
            return NextResponse.json({ error: "Missing step or data payload" }, { status: 400 });
        }

        const team = await prisma.team.findUnique({
            where: { id: ctx.teamId },
            select: { branding: true, aiConfig: true }
        });

        if (!team) {
            return NextResponse.json({ error: "Team not found" }, { status: 404 });
        }

        const currentBranding = typeof team.branding === 'object' && team.branding !== null ? team.branding as any : {};
        const currentAiConfig = typeof team.aiConfig === 'object' && team.aiConfig !== null ? team.aiConfig as any : {};

        let updateData: any = {};

        switch (step) {
            case 2: // Brand Identity
                // data should contain { companyName, logoUrl, primaryColor, accentColor, portalTitle, guidelinesUrl }
                if (data.companyName) {
                    updateData.name = data.companyName;
                }
                
                const newBranding = {
                    ...currentBranding,
                    logoUrl: data.logoUrl ?? currentBranding.logoUrl,
                    primaryColor: data.primaryColor ?? currentBranding.primaryColor,
                    accentColor: data.accentColor ?? currentBranding.accentColor,
                    portalTitle: data.portalTitle ?? currentBranding.portalTitle,
                    guidelinesUrl: data.guidelinesUrl ?? currentBranding.guidelinesUrl,
                };
                updateData.branding = newBranding;
                break;

            case 5: // Email Voice & Signature
                // data should contain { tone, voice, constraints, emailSignature, greetingStyle, signOff, ctaStyle }
                const newAiConfigVoice = {
                    ...currentAiConfig,
                    tone: data.tone ?? currentAiConfig.tone,
                    voice: data.voice ?? currentAiConfig.voice,
                    constraints: data.constraints ?? currentAiConfig.constraints,
                    emailSignature: data.emailSignature ?? currentAiConfig.emailSignature,
                    greetingStyle: data.greetingStyle ?? currentAiConfig.greetingStyle,
                    signOff: data.signOff ?? currentAiConfig.signOff,
                    ctaStyle: data.ctaStyle ?? currentAiConfig.ctaStyle,
                };
                updateData.aiConfig = newAiConfigVoice;
                break;

            case 6: // AI Config (Gemini)
                if (data.geminiKey) {
                    updateData.aiConfig = {
                        ...currentAiConfig,
                        apiKey: data.geminiKey
                    };
                }
                break;

            case 9: // Email Attachments & Media Kit
                // data contains { calendarLink, demoUrl }
                // Uploaded files are handled by the /api/upload/pdf route, creating KnowledgeItems
                const newAiConfigMedia = {
                    ...currentAiConfig,
                    calendarLink: data.calendarLink ?? currentAiConfig.calendarLink,
                    mediaKit: {
                        ...(currentAiConfig.mediaKit || {}),
                        demoUrl: data.demoUrl ?? currentAiConfig.mediaKit?.demoUrl
                    }
                };
                updateData.aiConfig = newAiConfigMedia;
                break;

            default:
                // Steps like 1, 3, 4, 7, 8, 10, 11 are either read-only stats, redirect out, or use existing endpoints (like /api/upload)
                return NextResponse.json({ message: "No save logic defined for this step" });
        }

        if (Object.keys(updateData).length > 0) {
            await prisma.team.update({
                where: { id: ctx.teamId },
                data: updateData
            });
        }

        return NextResponse.json({ success: true, updated: Object.keys(updateData) });

    } catch (error: any) {
        console.error("Setup save error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
