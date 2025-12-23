import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const policy = await prisma.guardrailPolicy.findUnique({
        where: { teamId: ctx.teamId }
    });

    // Return default if not exists
    if (!policy) {
        return NextResponse.json({
            teamId: ctx.teamId,
            blocklist: [],
            allowlist: [],
            maxDailyMsgs: 100,
            detectPII: true,
            strictness: "medium"
        });
    }

    return NextResponse.json(policy);
}

export async function PUT(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { blocklist, allowlist, maxDailyMsgs, detectPII, strictness } = body;

    const policy = await prisma.guardrailPolicy.upsert({
        where: { teamId: ctx.teamId },
        update: {
            blocklist,
            allowlist,
            maxDailyMsgs,
            detectPII,
            strictness
        },
        create: {
            teamId: ctx.teamId,
            blocklist,
            allowlist,
            maxDailyMsgs,
            detectPII,
            strictness
        }
    });

    return NextResponse.json(policy);
}
