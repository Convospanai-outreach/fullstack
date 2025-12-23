import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { setupUser } from "@/lib/auth";
import { AuditService } from "@/modules/audit/auditService";

export async function POST(req: Request) {
    try {
        const { name, email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        const hashedPassword = await hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
            }
        });

        // Initialize user with default settings and empty team
        await setupUser({
            id: user.id,
            email: user.email,
            name: user.name
        });

        // Get the teamId created in setupUser
        const membership = await prisma.teamMember.findFirst({
            where: { userId: user.id }
        });

        // Audit Log
        if (membership) {
            await AuditService.log(membership.teamId, user.id, "USER_CREATED", "Auth", user.id, { email: user.email });
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error: any) {
        console.error("Registration error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
