
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compare } from "bcryptjs";

export async function POST(req: Request) {
    // Security: Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { email, password } = body;

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found within Next.js runtime" }, { status: 404 });
        }

        const isValid = await compare(password, user.password);

        return NextResponse.json({
            success: true,
            userFound: true,
            passwordValid: isValid,
            // Removed hash exposure for security
            storedHash: "REDACTED" 
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
