import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const activities = await prisma.activity.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json(activities);
}

export async function POST(req: Request) {
    const body = await req.json();
    const created = await prisma.activity.create({ data: body });
    return NextResponse.json(created);
}
