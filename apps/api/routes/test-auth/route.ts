
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compare } from "bcryptjs";

export async function POST(req: Request) {
    // This endpoint is for explicit local/CI diagnostics only.
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_TEST_AUTH !== 'true') {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    try {
        const body = await req.json();
        const { email, password } = body;

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user?.password) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const isValid = await compare(password, user.password);
        if (!isValid) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        return NextResponse.json({
            success: true,
            userFound: true,
            passwordValid: true,
            // Removed hash exposure for security
            storedHash: "REDACTED" 
        });

    } catch (e: any) {
        console.error("Test auth diagnostic failed:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
