import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Marketplace...');

    const templates = [
        {
            name: 'Outreach Specialist',
            description: 'Autonomous agent specialized in crafting personalized LinkedIn connection requests and follow-ups.',
            type: 'AGENT',
            category: 'Sales',
            icon: 'UserCheck',
            config: {
                model: 'gpt-4o',
                temperature: 0.7,
                systemPrompt: "You are an expert SDR...",
                tools: ['linkedin_search', 'email_send']
            },
            metrics: { successRate: '92%', users: 120 },
            isOfficial: true,
            author: 'ConvoSpan'
        },
        {
            name: 'Lead Scoring Workflow',
            description: 'Automated workflow that enriches lead data via Clearbit and assigns a readiness score.',
            type: 'WORKFLOW',
            category: 'Operations',
            icon: 'Zap',
            config: {
                steps: ['webhook_trigger', 'enrich_lead', 'score_lead', 'update_crm']
            },
            metrics: { avgTime: '450ms', cost: '$0.01' },
            isOfficial: true,
            author: 'ConvoSpan Workflows'
        },
        {
            name: 'SaaS Launch Playbook',
            description: 'A complete multi-channel campaign structure for launching a new B2B SaaS product.',
            type: 'PLAYBOOK',
            category: 'Marketing',
            icon: 'BookOpen',
            config: {
                channels: ['Email', 'LinkedIn', 'Twitter'],
                durationDays: 14
            },
            metrics: { avgOpenRate: '45%' },
            isOfficial: true,
            author: 'Growth Team'
        }
    ];

    for (const tpl of templates) {
        await prisma.marketplaceTemplate.create({
            data: tpl
        });
        console.log(`Created: ${tpl.name}`);
    }

    console.log('Seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
