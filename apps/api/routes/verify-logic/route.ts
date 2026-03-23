
import { NextResponse } from "next/server";
import { automationService } from "@/modules/automations/service/AutomationService"; // Adjust import path
import { prisma } from "@/lib/db";
import { CampaignService } from "@/lib/campaignService";

export async function GET() {
    // Security: Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }

    try {
        const team = await prisma.team.findFirst();
        if (!team) return NextResponse.json({ error: "No team found" });

        // 1. Create Mock Campaigns for each mode
        const modes = ["saferun", "hybrid", "autonomous"];
        const results: Record<string, any> = {};

        for (const mode of modes) {
            const campaign = await CampaignService.createCampaign({
                name: `Test Logic ${mode}`,
                teamId: team.id,
                aiConfig: { executionMode: mode }
            });

            // Mock Automation Definition
            const automation = await prisma.automation.create({
                data: {
                    name: `Test Auto ${mode}`,
                    teamId: team.id,
                    trigger: "test.trigger",
                    action: "email.reply",
                    requiresApproval: false, // Default false, so we rely on Campaign config
                    isActive: true,
                    config: {}
                }
            });

            // Evaluate
            const context = { campaignId: campaign.id, confidence: 0.85 }; // Below 0.9 threshold for Hybrid

            // Hack: We can't call private method, but we can call 'evaluate' and see if it creates a log
            // Actually, we can just create a log manually and then check approvals? 
            // Better: We can expose a public test helper or just access it via 'any' processing
            // OR checks logs created.

            // Let's call evaluate()
            await (automationService as any).processAutomation(automation, context);

            // Check if log exists and status
            const log = await prisma.automationLog.findFirst({
                where: { automationId: automation.id },
                orderBy: { createdAt: 'desc' }
            });

            results[mode] = {
                status: log?.status,
                expected: mode === 'autonomous' ? 'success' : 'pending_approval' // Hybrid (0.85) should be pending
            };

            // Cleanup
            await prisma.automationLog.deleteMany({ where: { automationId: automation.id } });
            await prisma.automation.delete({ where: { id: automation.id } });
            await prisma.campaign.delete({ where: { id: campaign.id } });
        }

        return NextResponse.json({ results });

    } catch (e: any) {
        return NextResponse.json({ error: e.message, stack: e.stack });
    }
}
