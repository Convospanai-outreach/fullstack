import { PrismaClient, ProductMode, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
    console.log("🌱 Seeding Enterprise Readiness Data...");

    // 1. Create Enterprise Team
    const team = await prisma.team.upsert({
        where: { id: "ci-enterprise-team" },
        update: {},
        create: {
            id: "ci-enterprise-team",
            name: "CI Enterprise Corp",
            organizationPolicy: {
                create: {
                    productMode: ProductMode.ENTERPRISE_CORE
                }
            },
            contractProfile: {
                create: {
                    contractStatus: "ACTIVE",
                    allowedCapabilityLayers: ["CORE", "GOVERNED_AI"],
                    aiUsageLimit: 5000
                }
            }
        }
    });

    // 2. Create Diverse Roles
    await prisma.user.upsert({
        where: { email: "admin@ci.com" },
        update: {},
        create: {
            email: "admin@ci.com",
            name: "CI Admin",
            role: "admin",
            enterpriseRole: UserRole.ORG_ADMIN
        }
    });

    await prisma.user.upsert({
        where: { email: "compliance@ci.com" },
        update: {},
        create: {
            email: "compliance@ci.com",
            name: "CI Compliance",
            role: "user",
            enterpriseRole: UserRole.COMPLIANCE_OFFICER
        }
    });

    // 3. Create GuardrailPolicy
    await prisma.guardrailPolicy.upsert({
        where: { teamId: team.id },
        update: {},
        create: {
            teamId: team.id,
            detectPII: true,
            strictness: "high",
            blocklist: ["PII", "PROFANITY"]
        }
    });

    // 4. Create Feature Flag
    // We already have linkedin_automation check
    const existingFlag = await prisma.featureFlag.findUnique({ where: { key: "linkedin_automation" } });
    if (!existingFlag) {
        await prisma.featureFlag.create({
            data: {
                key: "linkedin_automation",
                isEnabled: true,
                layer: "CORE"
            }
        });
    } else {
        await prisma.featureFlag.update({
            where: { key: "linkedin_automation" },
            data: { isEnabled: true }
        });
    }

    // 5. Create Lead with Consent & Thread
    const lead = await prisma.lead.create({
        data: {
            teamId: team.id,
            email: "consented-lead@test.com",
            fullName: "Consented Lead",
            consentObtained: true,
            whatsappConsent: false,
            pipelineState: "INITIATED"
        }
    });

    await prisma.conversationThread.create({
        data: {
            leadId: lead.id,
            state: "INITIATED"
        }
    });

    // 6. Create Traceable Audit Log
    const admin = await prisma.user.findUnique({ where: { email: "admin@ci.com" } });
    await prisma.auditLog.create({
        data: {
            orgId: team.id,
            actorId: admin?.id,
            action: "CI_VALIDATION_SEED",
            entity: "SYSTEM",
            metadata: { status: "Ready" },
            correlationId: "ci-trace-123"
        }
    });

    console.log("✅ Readiness Seeding Complete.");
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
