/**
 * Score Explanation API
 * 
 * GET /api/scoring/explain/[leadId] - Get full score explanation
 * Returns human-readable summary, factor breakdown, case study match, and data quality.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { leadScoringService, caseStudyService } from "@/modules/scoring";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(
    _req: NextRequest,
    { params }: { params: { leadId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { leadId } = params;

        if (!leadId) {
            return NextResponse.json(
                { error: "leadId is required" },
                { status: 400 }
            );
        }

        // Fetch lead with scoring data
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: {
                id: true,
                fullName: true,
                company: true,
                jobTitle: true,
                teamId: true,
                dwellTimeMinutes: true,
                emailClicks: true,
                socialMentions: true,
                intentScore: true,
                lastScoredAt: true,
                clusterLabel: true,
                churnRisk: true,
                optimalSendHour: true
            }
        });

        if (!lead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        // Generate score explanation
        const explanation = leadScoringService.generateExplanation(leadId, {
            dwellTimeMinutes: lead.dwellTimeMinutes ?? 0,
            emailClicks: lead.emailClicks ?? 0,
            socialMentions: lead.socialMentions ?? 0
        });

        // Try to find matching case study if team exists
        let caseStudyMatch = null;
        if (lead.teamId && lead.company) {
            try {
                const relevantCaseStudies = await caseStudyService.retrieveRelevantCaseStudies(
                    `${lead.company} ${lead.jobTitle || ''} ${lead.fullName || ''}`,
                    lead.teamId,
                    1
                );

                if (relevantCaseStudies.length > 0) {
                    const match = relevantCaseStudies[0];
                    if (match) {
                        caseStudyMatch = {
                            id: match.id,
                            title: match.title,
                            similarity: match.similarity,
                            relevantMetric: Object.entries(match.metrics)
                                .map(([k, v]) => `${k}: ${v}`)
                                .join(', ') || 'Similar profile in database'
                        };
                    }
                }
            } catch (err) {
                // Case study lookup is optional
                logger.info("[Explain] Case study lookup skipped", { error: err instanceof Error ? err.message : String(err) });
            }
        }

        // Build complete explanation response
        const response = {
            ...explanation,
            caseStudyMatch,
            predictiveInsights: {
                clusterLabel: lead.clusterLabel,
                churnRisk: lead.churnRisk,
                optimalSendHour: lead.optimalSendHour
            },
            leadContext: {
                fullName: lead.fullName,
                company: lead.company,
                jobTitle: lead.jobTitle
            },
            cachedScore: lead.intentScore,
            lastScoredAt: lead.lastScoredAt
        };

        return NextResponse.json({
            success: true,
            data: response
        });
    } catch (error: any) {
        console.error("[API] Explain Score Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to explain score" },
            { status: 500 }
        );
    }
}
