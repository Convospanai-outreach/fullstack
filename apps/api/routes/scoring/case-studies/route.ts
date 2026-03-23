/**
 * Case Studies API
 * 
 * GET    - List case studies
 * POST   - Create/ingest case study
 * DELETE - Remove case study (DPDP compliance)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { caseStudyService } from "@/modules/scoring";
import { prisma } from "@/lib/db";

async function getTeamId(userId: string): Promise<string | null> {
    const member = await prisma.teamMember.findFirst({
        where: { userId },
        select: { teamId: true }
    });
    return member?.teamId ?? null;
}

export async function GET(_req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const teamId = await getTeamId(session.user.id);
        if (!teamId) {
            return NextResponse.json({ error: "No team found" }, { status: 400 });
        }

        const caseStudies = await caseStudyService.listCaseStudies(teamId);

        return NextResponse.json({
            success: true,
            data: caseStudies
        });
    } catch (error: any) {
        console.error("[API] List Case Studies Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to list case studies" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const teamId = await getTeamId(session.user.id);
        if (!teamId) {
            return NextResponse.json({ error: "No team found" }, { status: 400 });
        }

        const body = await req.json();
        const { action } = body;

        // Generate RAG-enhanced copy
        if (action === "generate-copy") {
            const { leadContext, purpose } = body;

            if (!leadContext || !purpose) {
                return NextResponse.json(
                    { error: "leadContext and purpose required" },
                    { status: 400 }
                );
            }

            const result = await caseStudyService.generateRAGEnhancedCopy(
                leadContext,
                purpose,
                teamId
            );

            return NextResponse.json({
                success: true,
                data: result
            });
        }

        // Ingest new case study
        const { title, industry, summary, content, metrics } = body;

        if (!title || !industry || !summary || !content) {
            return NextResponse.json(
                { error: "title, industry, summary, and content are required" },
                { status: 400 }
            );
        }

        const caseStudy = await caseStudyService.ingestCaseStudy(
            { title, industry, summary, content, metrics },
            teamId
        );

        return NextResponse.json({
            success: true,
            data: {
                id: caseStudy.id,
                title: caseStudy.title,
                industry: caseStudy.industry,
                message: "Case study ingested and embeddings generated"
            }
        });
    } catch (error: any) {
        console.error("[API] Case Study Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to process case study" },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const teamId = await getTeamId(session.user.id);
        if (!teamId) {
            return NextResponse.json({ error: "No team found" }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const caseStudyId = searchParams.get("id");

        if (!caseStudyId) {
            return NextResponse.json(
                { error: "Case study id required" },
                { status: 400 }
            );
        }

        const deleted = await caseStudyService.deleteCaseStudy(caseStudyId, teamId);

        if (deleted) {
            return NextResponse.json({
                success: true,
                message: "Case study deleted"
            });
        } else {
            return NextResponse.json(
                { error: "Case study not found or access denied" },
                { status: 404 }
            );
        }
    } catch (error: any) {
        console.error("[API] Delete Case Study Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to delete case study" },
            { status: 500 }
        );
    }
}
