import crypto from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";
import { AuditService } from "@/modules/audit/auditService";
import { sendViaSMTP } from "@/lib/email/smtpClient";
import { UserRole } from "@/types/prisma-safe";

export const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export function createInviteToken() {
    return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

export function getAppBaseUrl() {
    return (process.env["NEXTAUTH_URL"] || process.env["APP_URL"] || "http://localhost:3000").replace(/\/$/, "");
}

export function getInviteLink(token: string) {
    return `${getAppBaseUrl()}/accept-invite?token=${encodeURIComponent(token)}`;
}

export function isAssignableInviteRole(role: string): role is UserRole {
    return Object.values(UserRole).includes(role as UserRole);
}

export async function maybeSendInviteEmail(email: string, inviteLink: string) {
    const host = process.env["SMTP_HOST"];
    const user = process.env["SMTP_USER"];
    const password = process.env["SMTP_PASSWORD"];
    const fromEmail = process.env["SMTP_FROM_EMAIL"] || user;

    if (!host || !user || !password || !fromEmail) {
        return false;
    }

    const port = Number(process.env["SMTP_PORT"] || 587);
    const secure = (process.env["SMTP_SECURE"] || "").toLowerCase() === "true" || port === 465;
    const fromName = process.env["SMTP_FROM_NAME"] || "CraftMyFunnel";

    await sendViaSMTP({ host, port, secure, user, password, fromName, fromEmail }, {
        to: email,
        subject: "You have been invited to CraftMyFunnel",
        html: `<p>You have been invited to join CraftMyFunnel.</p><p><a href="${inviteLink}">Accept your invite</a></p>`
    });

    return true;
}

export async function findValidInvitation(token: string) {
    const tokenHash = hashInviteToken(token);
    const invitation = await prisma.userInvitation.findUnique({
        where: { tokenHash },
        include: {
            team: { select: { id: true, name: true } },
            invitedBy: { select: { id: true, name: true, email: true } }
        }
    });

    if (!invitation) {
        return { invitation: null, error: "Invalid invitation link." };
    }

    if (invitation.status !== "pending") {
        return { invitation: null, error: `Invitation is ${invitation.status}.` };
    }

    if (invitation.expiresAt <= new Date()) {
        await prisma.userInvitation.update({
            where: { id: invitation.id },
            data: { status: "expired" }
        });
        return { invitation: null, error: "Invitation has expired." };
    }

    return { invitation, error: null };
}

export async function acceptInvitation(token: string, input: { name?: string; password: string }) {
    const { invitation, error } = await findValidInvitation(token);
    if (!invitation) {
        throw new Error(error || "Invalid invitation link.");
    }

    const passwordHash = await hash(input.password, 12);
    const now = new Date();

    const result = await prisma.$transaction(async (tx: any) => {
        const updateData = {
            password: passwordHash,
            enterpriseRole: invitation.role,
            emailVerified: now,
            ...(input.name ? { name: input.name } : {})
        };

        const user = await tx.user.upsert({
            where: { email: invitation.email },
            update: updateData,
            create: {
                email: invitation.email,
                password: passwordHash,
                name: input.name || null,
                enterpriseRole: invitation.role,
                emailVerified: now
            }
        });

        await tx.settings.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id, theme: "dark" }
        });

        const existingMembership = await tx.teamMember.findFirst({
            where: {
                teamId: invitation.teamId,
                OR: [{ userId: user.id }, { email: invitation.email }]
            }
        });

        if (existingMembership) {
            await tx.teamMember.update({
                where: { id: existingMembership.id },
                data: {
                    userId: user.id,
                    email: invitation.email,
                    role: invitation.role === UserRole.ORG_ADMIN ? "admin" : invitation.role === UserRole.VIEWER ? "viewer" : "member",
                    status: "active"
                }
            });
        } else {
            await tx.teamMember.create({
                data: {
                    teamId: invitation.teamId,
                    userId: user.id,
                    email: invitation.email,
                    role: invitation.role === UserRole.ORG_ADMIN ? "admin" : invitation.role === UserRole.VIEWER ? "viewer" : "member",
                    status: "active"
                }
            });
        }

        await tx.userInvitation.update({
            where: { id: invitation.id },
            data: { status: "accepted", acceptedAt: now }
        });

        if (invitation.inviteRequestId) {
            await tx.inviteRequest.update({
                where: { id: invitation.inviteRequestId },
                data: { status: "USED", activeAt: now, usedAt: now }
            });
        }

        return user;
    });

    await AuditService.log(
        invitation.teamId,
        result.id,
        "invite_accepted",
        "UserInvitation",
        invitation.id,
        { email: invitation.email, role: invitation.role }
    );

    return result;
}
