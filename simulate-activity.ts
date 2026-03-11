import { AIService } from "./src/lib/aiService";
import { RequestContext } from "./src/lib/requestContext";
import { prisma } from "./src/lib/db";
import { v4 as uuidv4 } from "uuid";

async function simulateActivity() {
    const correlationId = uuidv4();
    const teamId = "team-" + uuidv4().substring(0, 8);
    const userId = "user-" + uuidv4().substring(0, 8);

    console.log(`🚀 Setting up test data: Team ${teamId}, User ${userId}`);

    // 1. Create Team + Policy + Contract
    await prisma.team.create({
        data: {
            id: teamId,
            name: "Test Team",
            organizationPolicy: {
                create: {
                    productMode: "ENTERPRISE_CORE"
                }
            },
            contractProfile: {
                create: {
                    contractStatus: "ACTIVE",
                    allowedCapabilityLayers: ["GOVERNED_AI", "CORE"]
                }
            }
        }
    });

    // 1.5 Explicitly log an action to verify Audit Trail
    const { AuditService } = await import("./src/modules/audit/auditService");
    await AuditService.log(teamId, userId, "SIMULATION_START", "System", teamId, { mode: "TEST" }, "127.0.0.1", correlationId);

    // 2. Create User + Membership
    await prisma.user.create({
        data: {
            id: userId,
            email: `${userId}@example.com`,
            name: "Test User",
            enterpriseRole: "ORG_ADMIN",
            memberships: {
                create: {
                    teamId,
                    email: `${userId}@example.com`,
                    role: "ADMIN"
                }
            }
        }
    });

    // 3. Create a Plan record for the team (Optional but safer for usage checks)
    const plan = await prisma.plan.findFirst({ where: { name: "ENTERPRISE" } });
    if (plan) {
         await prisma.subscription.create({
             data: {
                 teamId,
                 planId: plan.id,
                 status: "ACTIVE"
             }
         });
    }

    console.log(`🚀 Simulating activity with Correlation ID: ${correlationId}`);
    
    await RequestContext.run({ correlationId, userId, teamId }, async () => {
        const ai = new AIService();
        try {
            await ai.askAI("Write a simple greeting", teamId, {
                taskType: "SUMMARY",
                containsPII: false
            });
        } catch (e) {
            console.log("AI Call finished (likely with safe-timeout/mock):", (e as Error).message);
        }
    });

    // Check if audit log was created with CID
    const logs = await prisma.auditLog.findMany({
        where: { correlationId },
        take: 5
    });

    console.log(`✅ Audit logs created for CID ${correlationId}: ${logs.length}`);
    if (logs.length > 0) {
        console.log(`   First action: ${logs[0].action}`);
    }
}

simulateActivity().catch(console.error).finally(() => process.exit(0));
