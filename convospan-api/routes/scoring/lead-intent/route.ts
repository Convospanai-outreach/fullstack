/**
 * Lead Intent Score API
 * 
 * POST - Calculate and return intent score for a lead
 * GET  - Retrieve score explanation for a lead
 * PUT  - Update scoring weights configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { leadScoringService } from "@/modules/scoring";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { leadId } = body;

        if (!leadId) {
            return NextResponse.json(
                { error: "leadId is required" },
                { status: 400 }
            );
        }

        const explanation = await leadScoringService.scoreAndPersist(leadId);

        return NextResponse.json({
            success: true,
            data: explanation
        });
    } catch (error: any) {
        logger.error("[API] Lead Intent Score Error:", error);

        // Handle DPDP compliance errors specifically
        if (error.message?.includes("DPDP_COMPLIANCE")) {
            return NextResponse.json(
                { error: "Consent required for scoring", code: "CONSENT_REQUIRED" },
                { status: 403 }
            );
        }

        return NextResponse.json(
            { error: error.message || "Failed to calculate score" },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const leadId = searchParams.get("leadId");

        if (!leadId) {
            return NextResponse.json(
                { error: "leadId query param required" },
                { status: 400 }
            );
        }

        // For GET, we generate explanation without persisting
        const { prisma } = await import("@/lib/db");
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: {
                id: true,
                dwellTimeMinutes: true,
                emailClicks: true,
                socialMentions: true,
                intentScore: true,
                lastScoredAt: true
            }
        });

        if (!lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        const explanation = leadScoringService.generateExplanation(leadId, {
            dwellTimeMinutes: lead.dwellTimeMinutes ?? 0,
            emailClicks: lead.emailClicks ?? 0,
            socialMentions: lead.socialMentions ?? 0
        });

        return NextResponse.json({
            success: true,
            data: {
                ...explanation,
                cachedScore: lead.intentScore,
                lastScoredAt: lead.lastScoredAt
            }
        });
    } catch (error: any) {
        logger.error("[API] Get Score Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to get score" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { weights } = body;

        if (!weights) {
            return NextResponse.json(
                { error: "weights object is required" },
                { status: 400 }
            );
        }

        leadScoringService.updateWeights(weights);

        return NextResponse.json({
            success: true,
            config: leadScoringService.getConfig()
        });
    } catch (error: any) {
        logger.error("[API] Update Weights Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update weights" },
            { status: 400 }
        );
    }
}
