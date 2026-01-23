import { prisma } from "@/lib/db";

export type OnboardingStepId = "api_key" | "create_campaign" | "import_leads" | "enable_automation";

export const ONBOARDING_STEPS: { id: OnboardingStepId, label: string, href: string }[] = [
    { id: "api_key", label: "Connect AI Provider", href: "/settings/keys" },
    { id: "import_leads", label: "Import your first Leads", href: "/leads" },
    { id: "create_campaign", label: "Draft a Campaign", href: "/campaigns/new" },
    { id: "enable_automation", label: "Activate SafeRun™", href: "/settings/governance" },
];

class OnboardingService {
    /**
     * Checks which steps the user has completed by querying real data.
     * We don't store "completed" state for everything, we just check existence.
     */
    async getOnboardingStatus(userId: string, teamId?: string) {
        if (!teamId) return [];

        const status = [];

        // 1. Check API Keys
        const settings = await prisma.settings.findUnique({ where: { userId } });
        if (settings?.apiKeyOpenAI || settings?.apiKeyGemini) {
            status.push("api_key");
        }

        // 2. Check Leads
        const leadCount = await prisma.lead.count({ where: { teamId } });
        if (leadCount > 0) status.push("import_leads");

        // 3. Check Campaigns
        const campaignCount = await prisma.campaign.count({ where: { teamId } });
        if (campaignCount > 0) status.push("create_campaign");

        // 4. Check Automations
        const automationCount = await prisma.automation.count({ where: { teamId } });
        if (automationCount > 0) status.push("enable_automation");

        return status;
    }
}

export const onboardingService = new OnboardingService();
