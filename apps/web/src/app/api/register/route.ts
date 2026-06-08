import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { acceptInvitation } from "@/lib/invitations";
import { prisma } from "@/lib/db";

function publicSignupEnabled() {
    return process.env["ENABLE_PUBLIC_SIGNUP"] === "true" && process.env["NODE_ENV"] !== "production";
}

async function createAccountFromInviteRequest(input: { email: string; name: string; password: string; token?: string }) {
    const inviteRequest = await prisma.inviteRequest.findFirst({
        where: {
            email: input.email,
            status: { in: ["APPROVED", "INVITED"] },
            ...(input.token ? { inviteToken: input.token } : {})
        }
    });

    if (!inviteRequest) {
        throw new Error("Signup is invite-only. Your email must match an approved invite request.");
    }

    const passwordHash = await hash(input.password, 12);
    const now = new Date();

    const result = await prisma.$transaction(async (tx: any) => {
        const user = await tx.user.create({
            data: {
                email: input.email,
                name: input.name || inviteRequest.name,
                password: passwordHash,
                emailVerified: now,
                settings: { create: { theme: "dark" } }
            },
            select: { id: true, email: true }
        });

        const team = await tx.team.create({
            data: {
                name: `${inviteRequest.company} Workspace`,
                members: { create: { userId: user.id, email: user.email, role: "admin", status: "active" } }
            },
            select: { id: true }
        });

        await tx.inviteRequest.update({
            where: { id: inviteRequest.id },
            data: { status: "USED", usedAt: now }
        });

        return { user, team };
    });

    return result;
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null);
    const token = typeof body?.inviteToken === "string" ? body.inviteToken : typeof body?.token === "string" ? body.token : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    if (token) {
        try {
            await acceptInvitation(token, { name, password });
            return NextResponse.json({ ok: true, redirectTo: "/dashboard" });
        } catch (error) {
            if (!email) {
                const message = error instanceof Error ? error.message : "Invalid invitation link.";
                return NextResponse.json({ error: message }, { status: 400 });
            }
        }
    }

    if (email) {
        try {
            await createAccountFromInviteRequest({
                email,
                name,
                password,
                ...(token ? { token } : {})
            });
            return NextResponse.json({ ok: true, redirectTo: "/dashboard" }, { status: 201 });
        } catch (error) {
            if (!publicSignupEnabled()) {
                const message = error instanceof Error ? error.message : "Signup is invite-only.";
                return NextResponse.json({ error: message }, { status: 403 });
            }
        }
    }

    if (!publicSignupEnabled()) {
        return NextResponse.json({ error: "Signup is invite-only. Request an invite to create an account." }, { status: 403 });
    }

    if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
        data: {
            email,
            name: name || null,
            password: passwordHash,
            emailVerified: new Date(),
            settings: { create: { theme: "dark" } }
        },
        select: { id: true, email: true }
    });

    const team = await prisma.team.create({
        data: {
            name: name ? `${name}'s Workspace` : "Development Workspace",
            members: { create: { userId: user.id, email: user.email, role: "admin", status: "active" } }
        },
        select: { id: true }
    });

    return NextResponse.json({ ok: true, userId: user.id, teamId: team.id, redirectTo: "/dashboard" }, { status: 201 });
}
