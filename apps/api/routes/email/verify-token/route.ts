import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { token } = body;
    if (!token) return NextResponse.json({ success: false, error: "token required" }, { status: 400 });

    const record = await prisma.verificationToken.findUnique({ where: { token } });
    if (!record) return NextResponse.json({ success: false, error: "Invalid token" }, { status: 404 });

    if (record.expires < new Date()) {
        await prisma.verificationToken.delete({ where: { token } });
        return NextResponse.json({ success: false, error: "Token expired" }, { status: 410 });
    }

    await prisma.verificationToken.delete({ where: { token } });
    return NextResponse.json({ success: true, email: record.identifier });
}
