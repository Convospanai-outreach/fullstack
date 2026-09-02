/**
 * Lead Intent Score API
 * 
 * POST - Calculate and return intent score for a lead
 * GET  - Retrieve score explanation for a lead
 * PUT  - Update scoring weights configuration
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { leadScoringService } from "@/modules/scoring";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

// updateWeights mutates a process-wide singleton (LeadScoringService's `this.config`
// is per-process, not per-team) - any authenticated user able to reach this endpoint
// could otherwise overwrite lead-scoring weights for every team on the instance.
// Restricted to admin roles, matching the pattern used by admin/audit and
// admin/agent-audit for other cross-tenant-impact configuration.
const SCORING_CONFIG_ROLES: UserRole[] = [UserRole.ORG_ADMIN, UserRole.SYSTEM_ADMIN, UserRole.SUPER_ADMIN];

const KNOWN_WEIGHT_KEYS = ["dwellTime", "emailClicks", "socialMentions"] as const;

function validateWeights(weights: unknown): Partial<Record<(typeof KNOWN_WEIGHT_KEYS)[number], number>> | null {
    if (!weights || typeof weights !== "object" || Array.isArray(weights)) return null;

    const input = weights as Record<string, unknown>;
    const validated: Partial<Record<(typeof KNOWN_WEIGHT_KEYS)[number], number>> = {};

    for (const [key, value] of Object.entries(input)) {
        if (!(KNOWN_WEIGHT_KEYS as readonly string[]).includes(key)) return null;
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10) return null;
        validated[key as (typeof KNOWN_WEIGHT_KEYS)[number]] = value;
    }

    return validated;
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
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

        const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { teamId: true } });
        if (!lead || lead.teamId !== ctx.teamId) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
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
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
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
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: {
                id: true,
                teamId: true,
                dwellTimeMinutes: true,
                emailClicks: true,
                socialMentions: true,
                intentScore: true,
                lastScoredAt: true
            }
        });

        if (!lead || lead.teamId !== ctx.teamId) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        const explanation = await leadScoringService.generateExplanation(leadId, {
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
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { id: ctx.userId }, select: { enterpriseRole: true } });
        if (!user || !SCORING_CONFIG_ROLES.includes(user.enterpriseRole)) {
            return NextResponse.json({ error: "Forbidden - Requires admin access" }, { status: 403 });
        }

        const body = await req.json();
        const { weights } = body;

        if (!weights) {
            return NextResponse.json(
                { error: "weights object is required" },
                { status: 400 }
            );
        }

        const validated = validateWeights(weights);
        if (!validated) {
            return NextResponse.json(
                { error: `weights must only contain finite numbers in [0, 10] for known keys (${KNOWN_WEIGHT_KEYS.join(", ")})` },
                { status: 400 }
            );
        }

        leadScoringService.updateWeights(validated);

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
