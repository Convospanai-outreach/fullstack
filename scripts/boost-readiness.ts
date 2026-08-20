import { AIService } from "./src/lib/aiService";
import { RequestContext } from "./src/lib/requestContext";
import { prisma } from "./src/lib/db";
import { AuditService } from "./src/modules/audit/auditService";
import { v4 as uuidv4 } from "uuid";
import { ProductMode, CapabilityLayer, UserRole } from "@prisma/client";

async function boostReadiness() {
    const correlationId = uuidv4();
    const teamId = "team-" + uuidv4().substring(0, 8);
    const userId = "user-" + uuidv4().substring(0, 8);

    console.log(`🚀 Boosting Readiness: Team ${teamId}, User ${userId}, CID ${correlationId}`);

    // 1. Create Team
    await prisma.team.create({
        data: {
            id: teamId,
            name: "Enterprise Pilot Team",
            organizationPolicy: {
                create: {
                    productMode: ProductMode.ENTERPRISE_CORE,
                    detectPII: true
                }
            },
            contractProfile: {
                create: {
                    contractStatus: "ACTIVE",
                    allowedCapabilityLayers: ["GOVERNED_AI", "CORE", "ADVANCED_OPS"]
                }
            }
        }
    });

    // 2. Create User
    await prisma.user.create({
        data: {
            id: userId,
            email: `${userId}@enterprise.com`,
            name: "Compliance Officer",
            enterpriseRole: UserRole.COMPLIANCE_OFFICER,
            memberships: {
                create: {
                    teamId,
                    email: `${userId}@enterprise.com`,
                    role: "ADMIN"
                }
            }
        }
    });

    // 3. Create Guardrail Policy
    await prisma.guardrailPolicy.create({
        data: {
            teamId,
            blocklist: ["competitor-x", "leaked-secret"],
            detectPII: true,
            strictness: "high"
        }
    });

    // 4. Create Feature Flag
    await prisma.featureFlag.upsert({
        where: { key: "linkedin_automation" },
        update: { isEnabled: true },
        create: {
            key: "linkedin_automation",
            isEnabled: true,
            layer: CapabilityLayer.GOVERNED_AI,
            description: "Enable sovereign LinkedIn automation"
        }
    });

    // 5. Create Lead with Consent
    await prisma.lead.create({
        data: {
            teamId,
            fullName: "Reginald Compliance",
            email: "reginald@compliant.com",
            consentObtained: true,
            status: "QUALIFIED",
            pipelineState: "WARM"
        }
    });

    // 6. Log Simulation Start with CID
    console.log("📝 Logging initial audit event...");
    await AuditService.log(
        teamId, 
        userId, 
        "PILOT_SIMULATION_START", 
        "System", 
        teamId, 
        { mode: "READINESS_BOOST", version: "1.0" }, 
        "127.0.0.1", 
        correlationId
    );

    // 7. Run AI Generation to trigger internal tracing
    console.log("🤖 Running traced AI generation...");
    await RequestContext.run({ correlationId, userId, teamId }, async () => {
        const ai = new AIService();
        try {
            // This will likely use a mock or fail due to key, but it will go through the middleware/service logic
            await ai.askAI("Trace this request", teamId, {
                taskType: "SUMMARY",
                containsPII: false,
                productMode: "ENTERPRISE_CORE"
            });
        } catch (e: any) {
            console.log("AI Generation reached terminal state:", e.message);
        }
    });

    // Verify logs
    const logs = await prisma.auditLog.findMany({
        where: { correlationId }
    });
    console.log(`✅ Boosting Complete. Audit logs with CID: ${logs.length}`);
}

boostReadiness()
    .catch(e => {
        console.error("❌ Boosting Failed:", e);
    })
    .finally(async () => {
        await prisma.$disconnect();
        process.exit(0);
    });
