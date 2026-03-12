import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const token = req.headers.get("Authorization");
    if (!token) {
        return NextResponse.json({ valid: false }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: token },
        select: { id: true, email: true, name: true }
    });

    if (user) {
        return NextResponse.json({ valid: true, user });
    } else {
        return NextResponse.json({ valid: false }, { status: 401 });
    }
}
