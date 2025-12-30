import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";

// GET: List all users (Admin only)
export async function GET() {
    try {
        const { userId } = await getCurrentContext();
        if (!userId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");

        const currentUser = await prisma.user.findUnique({ where: { id: userId } }) as any;
        if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
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
        if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "superadmin")) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const body = await req.json();
        const { email, name, role } = body; // Password would be handled by auth provider usually, but for manual creation we might just set up the user record

        if (!email) throw new APIError("Email is required", 400, "BAD_REQUEST");

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) throw new APIError("User already exists", 409, "CONFLICT");

        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                role: role || "user",
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
