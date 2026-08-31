import { prisma } from "@/lib/db";

export const playbookService = {
    /**
     * List playbooks for a specific team.
     */
    async listPlaybooks(teamId: string) {
        return prisma.playbook.findMany({
            where: { teamId },
            orderBy: { createdAt: 'desc' }
        });
    },

    /**
     * Create a new playbook, potentially from an existing campaign structure.
     */
    async createPlaybook(teamId: string, data: { name: string; description?: string; config: any; parameters?: string[] }) {
        const createData: any = {
            teamId,
            name: data.name,
            config: data.config,
            parameters: data.parameters || [],
            visibility: "INTERNAL"
        };
        if (data.description) {
            createData.description = data.description;
        }
        return prisma.playbook.create({ data: createData });
    },

    /**
     * Create a Campaign from a Playbook, filling in the parameters.
     */
    async instantiatePlaybook(playbookId: string, teamId: string, values: Record<string, string>) {
        const playbook = await prisma.playbook.findFirst({ where: { id: playbookId, teamId } });
        if (!playbook) throw new Error("Playbook not found");

        // 1. Deep clone config
        let configStr = JSON.stringify(playbook.config);

        // 2. Replacements (Basic string replacement for MVP)
        // In production, use a proper template engine like Handlebars if complex
        Object.entries(values).forEach(([key, val]) => {
            configStr = configStr.replace(new RegExp(`{{${key}}}`, 'g'), val);
        });

        const config = JSON.parse(configStr);

        // 3. Create Campaign
        // Assuming 'config' has steps/emails. We'll map them to the Campaign model structure.
        // For MVP, if config is just metadata, we strictly create the campaign entity.
        // If config contains 'emails' array, typical for this app, we create those concurrently.

        const campaign = await prisma.campaign.create({
            data: {
                teamId,
                name: `${playbook.name} (Instance)`, // User can rename later
                description: `Created from playbook: ${playbook.name}`,
                status: 'draft',
                type: 'standard', // or derived from config
            }
        });

        // If the template defines emails/steps
        if (config.emails && Array.isArray(config.emails)) {
            // Remediation [STUB-7]: In this architecture, emails are instantiated per lead,
            // but the Campaign structure defines the sequence via CampaignVariants.
            // We map template emails to CampaignVariants so they can be dispatched later.
            const variants = config.emails.map((email: any) => ({
                campaignId: campaign.id,
                subject: email.subject || "No Subject",
                body: email.body || "",
                weight: 100
            }));

            await (prisma as any).campaignVariant.createMany({ data: variants });
        }

        return campaign;
    }
};
