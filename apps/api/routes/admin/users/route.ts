import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { UserRole } from "@prisma/client";
import { checkAdmin } from "@/lib/admin";

// GET: List all users (Admin only)
export async function GET() {
    try {
        const isAdmin = await checkAdmin();
        if (!isAdmin) {
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
        const isAdmin = await checkAdmin();
        if (!isAdmin) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const body = await req.json();
        const { email, name, role, enterpriseRole } = body;

        if (!email) throw new APIError("Email is required", 400, "BAD_REQUEST");

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) throw new APIError("User already exists", 409, "CONFLICT");

        if (role && !["user", "admin"].includes(role)) {
            throw new APIError("Invalid role", 400, "BAD_REQUEST");
        }

        if (enterpriseRole && !Object.values(UserRole).includes(enterpriseRole)) {
            throw new APIError("Invalid enterpriseRole", 400, "BAD_REQUEST");
        }

        const derivedEnterpriseRole =
            enterpriseRole ||
            (role === "admin" ? UserRole.SYSTEM_ADMIN : UserRole.SALES_USER);

        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                role: role || "user",
                enterpriseRole: derivedEnterpriseRole,
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
        const isAdmin = await checkAdmin();
        if (!isAdmin) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const body = await req.json();
        const { id, role, enterpriseRole } = body;

        if (!id) throw new APIError("User id is required", 400, "BAD_REQUEST");

        const data: Record<string, any> = {};
        if (role) {
            if (!["user", "admin"].includes(role)) {
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
