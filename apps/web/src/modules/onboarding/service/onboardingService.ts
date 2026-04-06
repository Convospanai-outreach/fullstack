import { prisma } from "@/lib/db";

export type OnboardingStepId = "api_key" | "create_campaign" | "import_leads";

export const ONBOARDING_STEPS: { id: OnboardingStepId, label: string, href: string }[] = [
    { id: "api_key", label: "Connect AI Provider", href: "/settings/keys" },
    { id: "import_leads", label: "Import your first leads", href: "/leads" },
    { id: "create_campaign", label: "Draft a campaign", href: "/campaigns/new" },
];

class OnboardingService {
    /**
     * Checks which steps the user has completed by querying real data.
     * We don't store "completed" state for everything, we just check existence.
     */
    async getOnboardingStatus(userId: string, teamId: string | null) {
        const completedIds: string[] = [];

        if (!teamId) {
            return {
                percentComplete: 0,
                steps: ONBOARDING_STEPS.map((step) => ({ ...step, completed: false })),
            };
        }

        const settings = await prisma.settings.findUnique({ where: { userId } });
        if (settings?.apiKeyOpenAI || settings?.apiKeyGemini) {
            completedIds.push("api_key");
        }

        const leadCount = await prisma.lead.count({ where: { teamId } });
        if (leadCount > 0) {
            completedIds.push("import_leads");
        }

        const campaignCount = await prisma.campaign.count({ where: { teamId } });
        if (campaignCount > 0) {
            completedIds.push("create_campaign");
        }

        const steps = ONBOARDING_STEPS.map((step) => ({
            ...step,
            completed: completedIds.includes(step.id),
        }));

        const percentComplete = Math.round((completedIds.length / ONBOARDING_STEPS.length) * 100);

        return {
            percentComplete,
            steps,
        };
    }
}

export const onboardingService = new OnboardingService();
