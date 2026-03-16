import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
    const requiredKey = process.env['EXTENSION_API_KEY'];
    const providedKey = req.headers.get("x-extension-key");
    if (!requiredKey || providedKey !== requiredKey) {
        return NextResponse.json({ valid: false }, { status: 401 });
    }
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
