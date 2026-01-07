/**
 * Verification Agent API
 * 
 * POST - Run verification on lead(s)
 * GET  - Get verification logs
 * DELETE - Purge lead data (DPDP Right to Erasure)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verificationAgent } from "@/modules/scoring";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { leadId, leadIds, config } = body;

        // Update config if provided
        if (config) {
            verificationAgent.updateConfig(config);
        }

        // Single lead verification
        if (leadId) {
            const result = await verificationAgent.verify(leadId);
            return NextResponse.json({
                success: true,
                data: result
            });
        }

        // Batch verification
        if (leadIds && Array.isArray(leadIds)) {
            const result = await verificationAgent.verifyBatch(leadIds);
            return NextResponse.json({
                success: true,
                data: result
            });
        }

        return NextResponse.json(
            { error: "leadId or leadIds array required" },
            { status: 400 }
        );
    } catch (error: any) {
        console.error("[API] Verification Error:", error);
        return NextResponse.json(
            { error: error.message || "Verification failed" },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const leadId = searchParams.get("leadId");
        const limit = parseInt(searchParams.get("limit") || "50");

        // Get team ID
        const member = await prisma.teamMember.findFirst({
            where: { userId: session.user.id },
            select: { teamId: true }
        });

        if (!member?.teamId) {
            return NextResponse.json({ error: "No team found" }, { status: 400 });
        }

        const where: any = { teamId: member.teamId };
        if (leadId) {
            where.leadId = leadId;
        }

        const logs = await prisma.verificationLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit
        });

        // Stats
        const stats = {
            total: logs.length,
            passed: logs.filter(l => l.passed).length,
            failed: logs.filter(l => !l.passed).length,
            averageScore: logs.length > 0
                ? logs.reduce((sum, l) => sum + l.score, 0) / logs.length
                : 0
        };

        return NextResponse.json({
            success: true,
            data: { logs, stats }
        });
    } catch (error: any) {
        console.error("[API] Get Logs Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to get logs" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const leadId = searchParams.get("leadId");

        if (!leadId) {
            return NextResponse.json(
                { error: "leadId query param required for data purge" },
                { status: 400 }
            );
        }

        // DPDP Act 2023: Right to Erasure
        const result = await verificationAgent.purgeLeadData(leadId);

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: "Lead scoring data purged per DPDP Act 2023",
                data: result
            });
        } else {
            return NextResponse.json(
                { error: "Purge failed", data: result },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error("[API] Purge Error:", error);
        return NextResponse.json(
            { error: error.message || "Purge failed" },
            { status: 500 }
        );
    }
}
