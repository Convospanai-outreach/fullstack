import { prisma } from "../lib/db";
import { ProductMode, UserRole, CapabilityLayer } from "@prisma/client";

/**
 * Enterprise Pilot Setup Script
 * 
 * Creates a fully configured enterprise organization with:
 * - ENTERPRISE_CORE product mode (maximum governance)
 * - Default organizational policies
 * - Feature flags configured for compliance
 * - Sample users with appropriate roles
 */

interface PilotOrgConfig {
    orgName: string;
    adminEmail: string;
    adminName: string;
    enableSSO?: boolean;
    maxDailyActions?: number;
}

export async function setupEnterprisePilot(config: PilotOrgConfig) {
    console.log(`\n🚀 Setting up Enterprise Pilot: ${config.orgName}\n`);

    // 1. Create Team
    console.log("1. Creating organization...");
    const team = await prisma.team.create({
        data: {
            name: config.orgName,
            credits: 1000 // Enterprise starter credits
        }
    });
    console.log(`   ✓ Team created: ${team.id}`);

    // 2. Create OrganizationPolicy with ENTERPRISE_CORE mode
    console.log("2. Configuring organizational policy...");
    const policy = await prisma.organizationPolicy.create({
        data: {
            organizationId: team.id,
            productMode: ProductMode.ENTERPRISE_CORE,
            maxDailyActions: config.maxDailyActions || 200,
            maxCampaigns: 10,
            maxAgents: 5,
            allowInMail: false, // Disabled for compliance
            allowScraping: false, // Disabled for compliance
            allowUploads: true,
            requiresApprovalForCampaign: true, // Enterprise governance
            blockedKeywords: ["guaranteed", "100%", "free money"], // Example compliance keywords
            detectPII: true,
            maxCreditsPerUser: 100,
            requiresApprovalForOverage: true
        }
    });
    console.log(`   ✓ Policy created with ENTERPRISE_CORE mode`);

    // 3. Configure SSO (if requested)
    if (config.enableSSO) {
        console.log("3. Configuring SSO (stub)...");
        await prisma.ssoConfiguration.create({
            data: {
                teamId: team.id,
                providerType: "SAML",
                enforced: false, // Start with optional SSO
                allowedDomains: [config.adminEmail.split("@")[1]]
            }
        });
        console.log(`   ✓ SSO configured for domain: ${config.adminEmail.split("@")[1]}`);
    }

    // 4. Create Admin User
    console.log("4. Creating admin user...");
    const adminUser = await prisma.user.create({
        data: {
            email: config.adminEmail,
            name: config.adminName,
            enterpriseRole: UserRole.ORG_ADMIN,
            credits: 500
        }
    });
    console.log(`   ✓ Admin user created: ${adminUser.email}`);

    // 5. Create Team Membership
    await prisma.teamMember.create({
        data: {
            teamId: team.id,
            userId: adminUser.id,
            email: config.adminEmail,
            role: "owner",
            status: "active"
        }
    });
    console.log(`   ✓ Admin added to team as owner`);

    // 6. Configure Feature Flags (Enterprise defaults)
    console.log("5. Configuring feature flags...");

    const features = [
        { key: "linkedin_automation", enabled: false, layer: CapabilityLayer.EXPERIMENTAL },
        { key: "ai_email_generation", enabled: true, layer: CapabilityLayer.CORE },
        { key: "approval_workflows", enabled: true, layer: CapabilityLayer.GOVERNED_AI },
        { key: "whatsapp_messaging", enabled: true, layer: CapabilityLayer.CORE },
        { key: "caller_queue", enabled: true, layer: CapabilityLayer.CORE },
        { key: "audit_logs", enabled: true, layer: CapabilityLayer.CORE },
        { key: "sso_login", enabled: config.enableSSO || false, layer: CapabilityLayer.ADVANCED_OPS }
    ];

    for (const feature of features) {
        await prisma.featureFlag.upsert({
            where: { key: feature.key },
            update: {},
            create: {
                key: feature.key,
                isEnabled: feature.enabled,
                layer: feature.layer,
                description: `${feature.key.replace(/_/g, " ")} feature`
            }
        });
    }
    console.log(`   ✓ ${features.length} feature flags configured`);

    // 7. Create Guardrail Policy
    console.log("6. Setting up guardrail policy...");
    await prisma.guardrailPolicy.create({
        data: {
            teamId: team.id,
            blocklist: ["spam", "scam", "fake"],
            allowlist: [],
            regexRules: [],
            competitorMentions: [],
            maxDailyMsgs: 100,
            detectPII: true,
            strictness: "high" // Enterprise default
        }
    });
    console.log(`   ✓ Guardrail policy created`);

    console.log(`\n✅ Enterprise Pilot Setup Complete!`);
    console.log(`\nOrganization ID: ${team.id}`);
    console.log(`Admin User ID: ${adminUser.id}`);
    console.log(`Product Mode: ENTERPRISE_CORE`);
    console.log(`\nNext Steps:`);
    console.log(`1. Admin should log in: ${adminUser.email}`);
    console.log(`2. Configure additional users with appropriate roles`);
    console.log(`3. Import leads with consent flags`);
    console.log(`4. Review and test approval workflows`);
    console.log(`5. Validate audit logging is working\n`);

    return { team, adminUser, policy };
}

// CLI execution
if (require.main === module) {
    const config: PilotOrgConfig = {
        orgName: process.argv[2] || "Pilot Enterprise Corp",
        adminEmail: process.argv[3] || "admin@pilot-enterprise.com",
        adminName: process.argv[4] || "Admin User",
        enableSSO: process.argv[5] === "true",
        maxDailyActions: parseInt(process.argv[6] || "200")
    };

    setupEnterprisePilot(config)
        .then(() => {
            console.log("Setup completed successfully!");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Setup failed:", error);
            process.exit(1);
        });
}
