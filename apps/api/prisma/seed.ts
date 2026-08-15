import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const plans = [
        {
            name: 'FREE',
            monthlyPrice: 0,
            creditsPerMonth: 50,
            maxAgents: 1,
            features: { emailSupport: false, apiAccess: false },
        },
        {
            name: 'PRO',
            monthlyPrice: 4900, // $49.00 - matches /pricing "Starter" tier
            creditsPerMonth: 500,
            maxAgents: 5,
            features: { emailSupport: true, apiAccess: true },
        },
        {
            name: 'GROWTH',
            monthlyPrice: 9900, // $99.00 - matches /pricing "Growth" tier
            creditsPerMonth: 2500,
            maxAgents: 10,
            features: { emailSupport: true, apiAccess: true },
        },
        {
            name: 'ENTERPRISE',
            monthlyPrice: 49900, // $499.00 - matches /pricing "Enterprise" tier
            creditsPerMonth: 15000,
            maxAgents: 20,
            features: { emailSupport: true, apiAccess: true, sso: true },
        },
    ];

    for (const plan of plans) {
        const upsertedPlan = await prisma.plan.upsert({
            where: { name: plan.name },
            update: plan,
            create: plan,
        });
        console.log(`Upserted plan: ${upsertedPlan.name}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
