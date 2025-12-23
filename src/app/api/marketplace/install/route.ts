import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AuditService } from "@/modules/audit/auditService";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { templateId } = await req.json();

    const template = await prisma.marketplaceTemplate.findUnique({
        where: { id: templateId }
    });

    if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    let installedItem;

    // INSTALL LOGIC BASED ON TYPE
    if (template.type === 'WORKFLOW' || template.type === 'AGENT') {
        // Create a new Workflow
        installedItem = await prisma.workflow.create({
            data: {
                teamId: ctx.teamId,
                name: `${template.name} (Copy)`,
                description: template.description,
                triggerType: 'MANUAL', // Default to manual, let user config
                nodes: (template.config as any).nodes || [],
                edges: (template.config as any).edges || [],
                isActive: false
            }
        });
        await AuditService.log(ctx.teamId, ctx.userId, "INSTALL_TEMPLATE", "Workflow", installedItem.id, { templateId });
    }
    else if (template.type === 'CAMPAIGN' || template.type === 'PLAYBOOK') {
        // Create a new Campaign (Logic assumes config matches Campaign structure)
        // For MVP, we might just create a shell campaign or fail if structure differs
        /* 
        installedItem = await prisma.campaign.create({ ... })
        */
        return NextResponse.json({ error: "Campaign installation not yet supported" }, { status: 501 });
    }

    return NextResponse.json(installedItem);
}
