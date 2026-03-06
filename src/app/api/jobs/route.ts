import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

// GET /api/jobs - List all jobs
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || undefined;
        const status = searchParams.get("status") || undefined;
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = parseInt(searchParams.get("offset") || "0");

        // const result = await JobQueue.dequeue(); 
        // Actually, JobQueue doesn't have a generic list method yet. Let's use Prisma directly in the route if needed or add it.
        // For now, let's keep it simple and use Prisma since it's just a GET route.
        const jobs = await prisma.job.findMany({
            where: {
                ...(type && { type }),
                ...(status && { status })
            },
            take: limit,
            skip: offset,
            orderBy: { createdAt: "desc" }
        });
        const result = jobs;

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error fetching jobs:", error);
        return NextResponse.json(
            { error: "Failed to fetch jobs" },
            { status: 500 }
        );
    }
}

// POST /api/jobs - Create new job
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { type, payload, priority } = body;

        if (!type || !payload) {
            return NextResponse.json(
                { error: "type and payload are required" },
                { status: 400 }
            );
        }

        const job = await JobQueue.enqueue(type, payload, { priority });

        return NextResponse.json(job, { status: 201 });
    } catch (error) {
        console.error("Error creating job:", error);
        return NextResponse.json(
            { error: "Failed to create job" },
            { status: 500 }
        );
    }
}
