import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { UserRole } from "@prisma/client";

// GET: List all users (Admin only)
export async function GET() {
    try {
        const { userId } = await getCurrentContext();
        if (!userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const currentUser = await prisma.user.findUnique({ where: { id: userId } }) as any;
        const legacyAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";
        const enterpriseAdmin =
            currentUser?.enterpriseRole === UserRole.SYSTEM_ADMIN ||
            currentUser?.enterpriseRole === UserRole.ORG_ADMIN;
        if (!currentUser || (!legacyAdmin && !enterpriseAdmin)) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const users = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                memberships: {
                    include: { team: true }
                }
            }
        });

        return NextResponse.json(users);
    } catch (error: any) {
        return handleAPIError(error);
    }
}

// POST: Create a new user (Admin only)
export async function POST(req: Request) {
    try {
        const { userId } = await getCurrentContext();
        if (!userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const currentUser = await prisma.user.findUnique({ where: { id: userId } }) as any;
        const legacyAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";
        const enterpriseAdmin =
            currentUser?.enterpriseRole === UserRole.SYSTEM_ADMIN ||
            currentUser?.enterpriseRole === UserRole.ORG_ADMIN;
        if (!currentUser || (!legacyAdmin && !enterpriseAdmin)) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const body = await req.json();
        const { email, name, role, enterpriseRole } = body;

        if (!email) throw new APIError("Email is required", 400, "BAD_REQUEST");

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) throw new APIError("User already exists", 409, "CONFLICT");

        if (role && !["user", "admin", "superadmin"].includes(role)) {
            throw new APIError("Invalid role", 400, "BAD_REQUEST");
        }

        if (enterpriseRole && !Object.values(UserRole).includes(enterpriseRole)) {
            throw new APIError("Invalid enterpriseRole", 400, "BAD_REQUEST");
        }

        const derivedEnterpriseRole =
            enterpriseRole ||
            (role === "superadmin" ? UserRole.SYSTEM_ADMIN : UserRole.SALES_USER);

        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                role: role || "user",
                enterpriseRole: derivedEnterpriseRole,
                // Note: We aren't storing passwords directly in this schema as we use NextAuth providers.
                // If we wanted credentials auth, we'd need a password field and hashing.
                // For now, this creates the user record so they can log in via provider or we can link them.
            }
        });

        return NextResponse.json(newUser);
    } catch (error: any) {
        return handleAPIError(error);
    }
}

// PATCH: Update user roles (Admin only)
export async function PATCH(req: Request) {
    try {
        const { userId } = await getCurrentContext();
        if (!userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const currentUser = await prisma.user.findUnique({ where: { id: userId } }) as any;
        const legacyAdmin = currentUser?.role === "admin" || currentUser?.role === "superadmin";
        const enterpriseAdmin =
            currentUser?.enterpriseRole === UserRole.SYSTEM_ADMIN ||
            currentUser?.enterpriseRole === UserRole.ORG_ADMIN;
        if (!currentUser || (!legacyAdmin && !enterpriseAdmin)) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const body = await req.json();
        const { id, role, enterpriseRole } = body;

        if (!id) throw new APIError("User id is required", 400, "BAD_REQUEST");

        const data: Record<string, any> = {};
        if (role) {
            if (!["user", "admin", "superadmin"].includes(role)) {
                throw new APIError("Invalid role", 400, "BAD_REQUEST");
            }
            data.role = role;
        }
        if (enterpriseRole) {
            if (!Object.values(UserRole).includes(enterpriseRole)) {
                throw new APIError("Invalid enterpriseRole", 400, "BAD_REQUEST");
            }
            data.enterpriseRole = enterpriseRole;
        }
        if (role === "superadmin" && !enterpriseRole) {
            data.enterpriseRole = UserRole.SYSTEM_ADMIN;
        }

        if (Object.keys(data).length === 0) {
            throw new APIError("No valid fields to update", 400, "BAD_REQUEST");
        }

        const updated = await prisma.user.update({
            where: { id },
            data
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        return handleAPIError(error);
    }
}
