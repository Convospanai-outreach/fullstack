import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return new NextResponse("User not found", { status: 404 });

    const body = await req.json();
    const { entity, filters } = body; // e.g., entity: "campaigns"

    // Enqueue export job
    const job = await JobQueue.enqueue("data_export", {
        entity,
        filters,
        userId: user.id
    });

    return NextResponse.json({ ok: true, jobId: job.id });
}
