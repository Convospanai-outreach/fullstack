/**
 * Predictive Analytics API
 * 
 * Endpoints for churn prediction, optimal send time, and customer clustering.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { predictiveService } from "@/modules/scoring";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const action = searchParams.get("action");
        const body = await req.json();

        switch (action) {
            case "churn": {
                const { leadId } = body;
                if (!leadId) {
                    return NextResponse.json({ error: "leadId required" }, { status: 400 });
                }
                const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { teamId: true } });
                if (!lead || lead.teamId !== ctx.teamId) {
                    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
                }
                const prediction = await predictiveService.predictChurn(leadId);
                return NextResponse.json({ success: true, data: prediction });
            }

            case "send-time": {
                const { leadId } = body;
                if (!leadId) {
                    return NextResponse.json({ error: "leadId required" }, { status: 400 });
                }
                const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { teamId: true } });
                if (!lead || lead.teamId !== ctx.teamId) {
                    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
                }
                const sendTime = await predictiveService.calculateOptimalSendTime(leadId);
                return NextResponse.json({ success: true, data: sendTime });
            }

            case "cluster": {
                const clusters = await predictiveService.clusterCustomers(ctx.teamId);
                return NextResponse.json({ success: true, data: clusters });
            }

            case "assign-cluster": {
                const { leadId } = body;
                if (!leadId) {
                    return NextResponse.json({ error: "leadId required" }, { status: 400 });
                }
                const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { teamId: true } });
                if (!lead || lead.teamId !== ctx.teamId) {
                    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
                }

                // Get lead features for cluster assignment
                const lead = await prisma.lead.findUnique({
                    where: { id: leadId },
                    select: {
                        value: true,
                        intentScore: true,
                        updatedAt: true,
                        emails: { select: { id: true } },
                        messages: { select: { id: true } }
                    }
                });

                if (!lead) {
                    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
                }

                const features = {
                    value: Math.min((lead.value || 0) / 10000, 1),
                    engagement: lead.intentScore || 0,
                    recency: Math.max(1 - ((Date.now() - lead.updatedAt.getTime()) / (90 * 24 * 60 * 60 * 1000)), 0),
                    frequency: Math.min((lead.emails.length + lead.messages.length) / 20, 1)
                };

                const assignment = predictiveService.assignToCluster(leadId, features);

                // Persist assignment
                await prisma.lead.update({
                    where: { id: leadId },
                    data: { clusterLabel: assignment.clusterLabel }
                });

                return NextResponse.json({ success: true, data: assignment });
            }

            default:
                return NextResponse.json(
                    { error: "Invalid action. Use: churn, send-time, cluster, or assign-cluster" },
                    { status: 400 }
                );
        }
    } catch (error: any) {
        logger.error("[API] Predictive Error:", error);
        return NextResponse.json(
            { error: error.message || "Prediction failed" },
            { status: 500 }
        );
    }
}

export async function GET(_req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Return cluster summary for the team
        const clusters = await predictiveService.clusterCustomers(ctx.teamId);

        return NextResponse.json({
            success: true,
            data: {
                clusters,
                summary: {
                    totalLeads: clusters.reduce((sum, c) => sum + c.memberCount, 0),
                    totalValue: clusters.reduce((sum, c) => sum + (c.averageValue * c.memberCount), 0)
                }
            }
        });
    } catch (error: any) {
        logger.error("[API] Get Clusters Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to get clusters" },
            { status: 500 }
        );
    }
}
