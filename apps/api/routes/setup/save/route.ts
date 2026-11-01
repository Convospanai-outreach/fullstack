import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { internalErrorMessage } from "@/lib/internalError";

// The data responsibility notice version (step 1). Keep in step with apps/web/src/lib/setupSteps.ts.
const DATA_RESPONSIBILITY_VERSION = "2026-11";

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        // MEMBER, not ADMIN: /setup/status (read) only requires MEMBER, and any invited
        // teammate who isn't explicitly ORG_ADMIN lands on team role "member" (see
        // googleOnboarding.ts's syncGoogleUserToApp) - requiring ADMIN here silently 403'd their
        // Save button on steps 2/5/6/9 while still letting them reach every other step
        // via the sidebar, so the gate blocked saving without actually blocking access.
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const body = await req.json();
        const { step, data } = body;

        if (!step || !data) {
            return NextResponse.json({ error: "Missing step or data payload" }, { status: 400 });
        }

        // Step 6 stores the team's AI provider key, which every member's AI usage is billed to, so it stays an admin action.
        if (step === 6 && !await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
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
            case 1: // Launch Brief: outreach for the user's own lead gen, or on behalf of a company
                if (data.outreachMode !== "personal" && data.outreachMode !== "company") {
                    return NextResponse.json({ error: "Choose personal or company." }, { status: 400 });
                }
                // The team owns its leads and their data: keep who agreed, when, and which notice version.
                if (data.acknowledgedDataResponsibility !== true) {
                    return NextResponse.json({ error: "Read the data responsibility notice and tick the box to continue." }, { status: 400 });
                }
                updateData.aiConfig = {
                    ...currentAiConfig,
                    outreachMode: data.outreachMode,
                    dataResponsibility: { version: DATA_RESPONSIBILITY_VERSION, acknowledgedBy: ctx.userId, acknowledgedAt: new Date().toISOString() },
                };
                break;

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
                // data should contain { tone, voice, formulation, constraints, emailSignature, greetingStyle, signOff, ctaStyle }
                const newAiConfigVoice = {
                    ...currentAiConfig,
                    tone: data.tone ?? currentAiConfig.tone,
                    voice: data.voice ?? currentAiConfig.voice,
                    formulation: data.formulation ?? currentAiConfig.formulation,
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
                // Steps like 3, 4, 7, 8, 10, 11 are either read-only stats, redirect out, or use existing endpoints (like /api/upload)
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
        return NextResponse.json({ error: internalErrorMessage(error) }, { status: 500 });
    }
}

