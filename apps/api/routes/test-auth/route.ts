
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compare } from "bcryptjs";

export async function POST(req: Request) {
    // Security: Explicit opt-in only
    if (process.env.ENABLE_TEST_AUTH !== 'true') {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
        const body = await req.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user || !user.password) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const isValid = await compare(password, user.password);

        if (!isValid) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        return NextResponse.json({
            success: true
        });

    } catch {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
