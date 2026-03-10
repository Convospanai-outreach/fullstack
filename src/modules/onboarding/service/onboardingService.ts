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
    async getOnboardingStatus(userId: string, teamId: string | null) {
        const completedIds = [];
        
        // Return 0 if no team context
        if (!teamId) {
            return {
                percentComplete: 0,
                steps: ONBOARDING_STEPS.map(s => ({ ...s, completed: false }))
            };
        }

        // 1. Check API Keys
        const settings = await prisma.settings.findUnique({ where: { userId } });
        if (settings?.apiKeyOpenAI || settings?.apiKeyGemini) {
            completedIds.push("api_key");
        }

        // 2. Check Leads
        const leadCount = await prisma.lead.count({ where: { teamId } });
        if (leadCount > 0) completedIds.push("import_leads");

        // 3. Check Campaigns
        const campaignCount = await prisma.campaign.count({ where: { teamId } });
        if (campaignCount > 0) completedIds.push("create_campaign");

        // 4. Check Automations
        const automationCount = await prisma.automation.count({ where: { teamId } });
        if (automationCount > 0) completedIds.push("enable_automation");

        const steps = ONBOARDING_STEPS.map(step => ({
            ...step,
            completed: completedIds.includes(step.id)
        }));

        const percentComplete = Math.round((completedIds.length / ONBOARDING_STEPS.length) * 100);

        return {
            percentComplete,
            steps
        };
    }
}

export const onboardingService = new OnboardingService();
