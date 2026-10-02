import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// Google sign-ins (and pre-existing users) arrive without a phone/company;
// password signups fill them in up front and are stamped complete.
export default async function ProfileCompletionGate({ children }: { children: ReactNode }) {
    const session = await auth();
    if (session?.user?.id) {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { profileCompletedAt: true },
        });
        if (user && !user.profileCompletedAt) redirect("/complete-profile");
    }
    return <>{children}</>;
}
