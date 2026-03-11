"use strict";

// src/scripts/seed-readiness.ts
var import_client = require("@prisma/client");
var prisma = new import_client.PrismaClient();
async function seed() {
  console.log("\u{1F331} Seeding Enterprise Readiness Data...");
  const team = await prisma.team.upsert({
    where: { id: "ci-enterprise-team" },
    update: {},
    create: {
      id: "ci-enterprise-team",
      name: "CI Enterprise Corp",
      organizationPolicy: {
        create: {
          productMode: import_client.ProductMode.ENTERPRISE_CORE
        }
      },
      contractProfile: {
        create: {
          contractStatus: "ACTIVE",
          allowedCapabilityLayers: ["CORE", "GOVERNED_AI"],
          aiUsageLimit: 5e3
        }
      }
    }
  });
  await prisma.user.upsert({
    where: { email: "admin@ci.com" },
    update: {},
    create: {
      email: "admin@ci.com",
      name: "CI Admin",
      role: "admin",
      enterpriseRole: import_client.UserRole.ORG_ADMIN
    }
  });
  await prisma.user.upsert({
    where: { email: "compliance@ci.com" },
    update: {},
    create: {
      email: "compliance@ci.com",
      name: "CI Compliance",
      role: "user",
      enterpriseRole: import_client.UserRole.COMPLIANCE_OFFICER
    }
  });
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
  const existingFlag = await prisma.featureFlag.findUnique({ where: { key: "linkedin_automation" } });
  if (!existingFlag) {
    await prisma.featureFlag.create({
      data: {
        key: "linkedin_automation",
        name: "LinkedIn Automation",
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
  await prisma.auditLog.create({
    data: {
      orgId: team.id,
      userId: "ci-system",
      action: "CI_VALIDATION_SEED",
      resource: "System",
      details: { status: "Ready" },
      correlationId: "ci-trace-123"
    }
  });
  console.log("\u2705 Readiness Seeding Complete.");
}
seed().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
