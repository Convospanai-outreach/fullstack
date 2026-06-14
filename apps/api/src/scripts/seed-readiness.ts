import { ProductMode, UserRole } from "@prisma/client";
import { prisma } from "../lib/db";
const TEAM_ID = "ci-enterprise-team";

async function upsertTeamMember(input: { teamId: string; userId: string; email: string; role: string }) {
    const existing = await prisma.teamMember.findFirst({
        where: { teamId: input.teamId, email: input.email }
    });

    if (existing) {
        await prisma.teamMember.update({
            where: { id: existing.id },
            data: { userId: input.userId, role: input.role, status: "active" }
        });
        return;
    }

    await prisma.teamMember.create({
        data: {
            teamId: input.teamId,
            userId: input.userId,
            email: input.email,
            role: input.role,
            status: "active"
        }
    });
}

async function seed() {
    const isCi = process.env["CI"] === "true" || process.env["GITHUB_ACTIONS"] === "true";
    if (process.env["NODE_ENV"] === "production" && !isCi && process.env["READINESS_SEED_PRODUCTION"] !== "true") {
        throw new Error("Refusing to seed readiness fixtures in production without READINESS_SEED_PRODUCTION=true.");
    }

    console.log("Seeding Enterprise Readiness Data...");

    const team = await prisma.team.upsert({
        where: { id: TEAM_ID },
        update: { name: "CI Enterprise Corp" },
        create: {
            id: TEAM_ID,
            name: "CI Enterprise Corp"
        }
    });

    await prisma.organizationPolicy.upsert({
        where: { organizationId: team.id },
        update: {
            productMode: ProductMode.ENTERPRISE_CORE,
            productSurface: "outreach",
            detectPII: true,
            allowUploads: true
        },
        create: {
            organizationId: team.id,
            productMode: ProductMode.ENTERPRISE_CORE,
            productSurface: "outreach",
            detectPII: true,
            allowUploads: true
        }
    });

    await prisma.contractProfile.upsert({
        where: { teamId: team.id },
        update: {
            contractStatus: "ACTIVE",
            allowedCapabilityLayers: ["CORE", "GOVERNED_AI"],
            aiUsageLimit: 5000
        },
        create: {
            teamId: team.id,
            contractStatus: "ACTIVE",
            allowedCapabilityLayers: ["CORE", "GOVERNED_AI"],
            aiUsageLimit: 5000
        }
    });

    const admin = await prisma.user.upsert({
        where: { email: "admin@ci.com" },
        update: {
            name: "CI Admin",
            role: "admin",
            enterpriseRole: UserRole.ORG_ADMIN
        },
        create: {
            email: "admin@ci.com",
            name: "CI Admin",
            role: "admin",
            enterpriseRole: UserRole.ORG_ADMIN
        }
    });

    const compliance = await prisma.user.upsert({
        where: { email: "compliance@ci.com" },
        update: {
            name: "CI Compliance",
            role: "user",
            enterpriseRole: UserRole.COMPLIANCE_OFFICER
        },
        create: {
            email: "compliance@ci.com",
            name: "CI Compliance",
            role: "user",
            enterpriseRole: UserRole.COMPLIANCE_OFFICER
        }
    });

    await upsertTeamMember({ teamId: team.id, userId: admin.id, email: admin.email, role: "admin" });
    await upsertTeamMember({ teamId: team.id, userId: compliance.id, email: compliance.email, role: "member" });

    await prisma.guardrailPolicy.upsert({
        where: { teamId: team.id },
        update: {
            detectPII: true,
            strictness: "high",
            blocklist: ["PII", "PROFANITY"]
        },
        create: {
            teamId: team.id,
            detectPII: true,
            strictness: "high",
            blocklist: ["PII", "PROFANITY"]
        }
    });

    await prisma.featureFlag.upsert({
        where: { key: "linkedin_automation" },
        update: {
            isEnabled: true,
            layer: "CORE",
            description: "Readiness fixture flag for governed LinkedIn workflows."
        },
        create: {
            key: "linkedin_automation",
            isEnabled: true,
            layer: "CORE",
            description: "Readiness fixture flag for governed LinkedIn workflows."
        }
    });

    const existingLead = await prisma.lead.findFirst({
        where: { teamId: team.id, email: "consented-lead@test.com" }
    });

    const lead = existingLead
        ? await prisma.lead.update({
            where: { id: existingLead.id },
            data: {
                fullName: "Consented Lead",
                consentObtained: true,
                whatsappConsent: true,
                whatsappConsentAt: new Date(),
                whatsappConsentBy: admin.id,
                pipelineState: "INITIATED"
            }
        })
        : await prisma.lead.create({
            data: {
                teamId: team.id,
                email: "consented-lead@test.com",
                fullName: "Consented Lead",
                consentObtained: true,
                whatsappConsent: true,
                whatsappConsentAt: new Date(),
                whatsappConsentBy: admin.id,
                pipelineState: "INITIATED"
            }
        });

    const existingThread = await prisma.conversationThread.findFirst({
        where: { leadId: lead.id, state: "INITIATED" }
    });
    if (!existingThread) {
        await prisma.conversationThread.create({
            data: {
                leadId: lead.id,
                state: "INITIATED"
            }
        });
    }

    for (const channel of ["EMAIL", "WHATSAPP"]) {
        const existingConsent = await prisma.consentLedger.findFirst({
            where: { leadId: lead.id, channel, status: "GRANTED" }
        });

        if (!existingConsent) {
            await prisma.consentLedger.create({
                data: {
                    leadId: lead.id,
                    userId: admin.id,
                    channel,
                    purpose: "Readiness validation",
                    status: "GRANTED",
                    proof: "readiness-seed",
                    notes: `Synthetic ${channel} consent record for readiness validation fixtures.`
                }
            });
        }
    }

    await prisma.systemEvent.create({
        data: {
            type: "SYSTEM",
            name: "READINESS_SEED",
            teamId: team.id,
            actorId: admin.id,
            correlationId: "ci-trace-123",
            payload: {
                message: "Readiness fixtures seeded",
                severity: "info",
                teamId: team.id
            }
        }
    });

    const existingAudit = await prisma.auditLog.findFirst({
        where: { orgId: team.id, action: "CI_VALIDATION_SEED", correlationId: "ci-trace-123" }
    });

    if (!existingAudit) {
        await prisma.auditLog.create({
            data: {
                orgId: team.id,
                actorId: admin.id,
                action: "CI_VALIDATION_SEED",
                entity: "SYSTEM",
                metadata: { status: "Ready" },
                correlationId: "ci-trace-123"
            }
        });
    }

    console.log("Readiness Seeding Complete.");
}

seed()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
