import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { email } = body;
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

    await prisma.verificationToken.deleteMany({ where: { identifier: email } });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await prisma.verificationToken.create({
        data: {
            identifier: email,
            token,
            expires
        }
    });

    return NextResponse.json({ token });
}
