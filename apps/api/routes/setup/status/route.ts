import { NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEdgeRuntimeAvailability } from "@/lib/edgeRuntime";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

const SENSITIVE_CONFIG_KEYS = [
    "apikey",
    "api_key",
    "secret",
    "token",
    "password",
    "privatekey",
    "encryptionkey",
];

function redactSensitiveConfig(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((entry) => redactSensitiveConfig(entry));
    }
    if (!value || typeof value !== "object") {
        return value;
    }

    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(input)) {
        const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
        const isSensitive = SENSITIVE_CONFIG_KEYS.some((sensitiveKey) =>
            normalizedKey.includes(sensitiveKey)
        );

        if (isSensitive) {
            output[key] = null;
            continue;
        }
        output[key] = redactSensitiveConfig(raw);
    }
    return output;
}

export async function GET(req: Request) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.MEMBER)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const user = await prisma.user.findUnique({
            where: { id: ctx.userId },
            include: { memberships: { where: { teamId: ctx.teamId } } }
        });

        const team = await prisma.team.findUnique({
            where: { id: ctx.teamId },
            include: {
                members: true,
                leads: { select: { id: true, email: true, linkedIn: true } },
                campaigns: { include: { variants: true, leadList: true } },
                knowledgeBases: true
            }
        });

        if (!user || !team) {
            return NextResponse.json({ error: "Context not found" }, { status: 404 });
        }

        const member = user.memberships[0];
        const branding = (team.branding as any) || {};
        const rawAiConfig = (team.aiConfig as any) || {};
        if (rawAiConfig.smtpConfig) {
            delete rawAiConfig.smtpConfig.password;
            delete rawAiConfig.smtpConfig.encryptedPassword;
        }
        const aiConfig = redactSensitiveConfig(rawAiConfig) as Record<string, unknown>;

        // Step 1: Account
        const hasAccount = !!user;
        const isEmailVerified = !!user.emailVerified;
        const hasTeamRole = member?.role || null;

        // Step 2: Brand
        const hasCompanyName = !!team.name;
        const hasLogo = !!branding.logoUrl;
        const hasPrimaryColor = !!branding.primaryColor;
        const brandingComplete = hasPrimaryColor && hasLogo;

        // Step 3: Email Integration
        const { getSmtpConfigRedacted } = await import("@/modules/email-campaigner/service/smtpConfigService");
        const smtpConfig = await getSmtpConfigRedacted(ctx.teamId);
        const hasSmtpConfig = !!smtpConfig;
        const canSendEmail = hasSmtpConfig;
        const hasCustomSender = hasSmtpConfig;

        // Step 4: LinkedIn
        const hasExtensionApiKey = !!process.env['EXTENSION_API_KEY'];
        const webBaseUrl = process.env['WEB_BASE_URL'] || process.env['NEXTAUTH_URL'] || "http://localhost:3000";
        const extensionApiBase = `${webBaseUrl.replace(/\/$/, "")}/api/proxy/extension`;
        const linkedInMode = process.env['LINKEDIN_EXECUTION_MODE'] || (hasExtensionApiKey ? "EXTENSION" : "EDGE");
        const hasBrowserNode = !!process.env['BROWSER_NODE_URL'] || !!process.env['BROWSER_WS_ENDPOINT'];
        // Task: Check real session status from user settings
        const userSettings = await prisma.settings.findUnique({ where: { userId: ctx.userId } });
        const hasLinkedInSession = linkedInMode === "EXTENSION" 
            ? !!userSettings?.liCookie 
            : false;

        // Step 5: Email Voice
        const hasToneSet = !!rawAiConfig.tone;
        const hasVoiceDescription = !!rawAiConfig.voice;
        const hasEmailSignature = !!rawAiConfig.emailSignature;
        const hasGreetingStyle = !!rawAiConfig.greetingStyle;
        const emailVoiceComplete = hasToneSet && hasEmailSignature;

        // Step 6: AI
        const hasGeminiKey = !!process.env['GEMINI_API_KEY'] || !!rawAiConfig.apiKey || !!rawAiConfig.providers?.gemini?.apiKey;
        const canGenerateMessage = hasGeminiKey;

        // Step 7: Leads
        const leadCount = team.leads.length;
        const leadsWithEmail = team.leads.filter(l => l.email).length;
        const leadsWithLinkedIn = team.leads.filter(l => l.linkedIn).length;
        const hasHunterKey = !!process.env['HUNTER_API_KEY'] || !!process.env['HUNTER_IO_API_KEY'];

        // Step 8: Campaign
        const campaignCount = team.campaigns.length;
        const hasVariants = team.campaigns.some(c => c.variants.length > 0);
        const hasAssignedLeads = team.campaigns.some(c => c.leadList.length > 0);

        // Step 9: Attachments
        const hasCalendarLink = !!rawAiConfig.calendarLink;
        const uploadedDocCount = team.knowledgeBases.length;
        const hasBrochure = team.knowledgeBases.some(kb => (kb as any).url?.toLowerCase().includes("brochure") || (kb as any).fileName?.toLowerCase().includes("brochure"));
        const hasCaseStudy = team.knowledgeBases.some(kb => (kb as any).url?.toLowerCase().includes("case") || (kb as any).fileName?.toLowerCase().includes("case"));

        // Step 10: Billing
        const teamCredits = team.credits;
        const hasPaymentMethod = !!process.env['RAZORPAY_KEY_ID'];

        // Step 11: Advanced
        const edgeAvailability = await getEdgeRuntimeAvailability();
        const hasWhatsApp = !!process.env['WHATSAPP_ACCESS_TOKEN'];
        const hasGoogleOAuth = !!process.env['GOOGLE_CLIENT_ID'];
        const hasRedis = !!process.env['REDIS_URL'];
        const hasEdgeNode = edgeAvailability.configured;
        const hasSlackAlerts = !!process.env['SLACK_WEBHOOK_URL'];

        // Overall
        const readyToLaunch =
            hasAccount &&
            isEmailVerified &&
            hasTeamRole === 'owner' &&
            hasCompanyName &&
            teamCredits > 0 &&
            emailVoiceComplete &&
            hasGeminiKey &&
            canSendEmail &&
            leadsWithEmail > 0 &&
            campaignCount > 0 &&
            hasVariants &&
            hasAssignedLeads;

        // Completion percent (rough estimate, 11 boolean checks)
        const checks = [
            hasAccount && isEmailVerified,
            !!hasTeamRole,
            brandingComplete,
            canSendEmail,
            hasLinkedInSession,
            emailVoiceComplete,
            hasGeminiKey,
            leadCount > 0,
            hasVariants && hasAssignedLeads,
            hasBrochure || hasCaseStudy || hasCalendarLink,
            teamCredits > 0
        ];
        const completionPercent = Math.round((checks.filter(Boolean).length / checks.length) * 100);

        return NextResponse.json({
            // Statuses mapped from steps
            hasAccount, isEmailVerified, hasTeam: true, hasTeamRole,
            hasCompanyName, hasLogo, hasPrimaryColor, brandingComplete,
            hasSmtpConfig, canSendEmail, hasCustomSender,
            hasLinkedInSession, hasBrowserNode, linkedInMode, hasExtensionApiKey, extensionApiBase,
            hasToneSet, hasVoiceDescription, hasEmailSignature, hasGreetingStyle, emailVoiceComplete,
            hasGeminiKey, canGenerateMessage,
            leadCount, leadsWithEmail, leadsWithLinkedIn, hasHunterKey,
            campaignCount, hasVariants, hasAssignedLeads,
            hasCalendarLink, uploadedDocCount, hasBrochure, hasCaseStudy,
            teamCredits, hasPaymentMethod,
            hasWhatsApp, hasGoogleOAuth, hasRedis, hasEdgeNode, hasSlackAlerts,
            edgeNodeAvailable: edgeAvailability.available,
            edgeNodeOptional: edgeAvailability.optional,
            edgeNodeStatus: edgeAvailability.status,
            edgeNodeMessage: edgeAvailability.message,
            readyToLaunch, completionPercent,

            // Raw config data so the UI can prefill forms
            branding,
            aiConfig,
            teamName: team.name,
        });

    } catch (error: any) {
        console.error("Setup status error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}


