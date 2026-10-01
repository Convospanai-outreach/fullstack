import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import DashboardShell from "./DashboardShell";

// Signed-in pages render per request so Next can attach proxy.ts's per-request CSP nonce
// to its scripts (roadmap 3.6 part 2: strict script policy for the signed-in app only).
export default async function DashboardLayout({ children }: { children: ReactNode }) {
    await connection();

    // Google sign-ins (and pre-existing users) arrive without a phone/company;
    // password signups fill them in up front and are stamped complete.
    const session = await auth();
    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { profileCompletedAt: true },
        });
        if (user && !user.profileCompletedAt) redirect("/complete-profile");
    }

    return <DashboardShell>{children}</DashboardShell>;
}
