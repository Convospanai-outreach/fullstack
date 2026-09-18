import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/types/prisma-safe";

// The platform-wide command center now requires its own, separate (non-OAuth)
// superadmin login at /superadmin - having SUPER_ADMIN/SYSTEM_ADMIN enterpriseRole
// here only gets you this far, not into the cross-tenant data itself.
export default async function AdminRootPage() {
    await requireRole([UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN]);
    redirect("/superadmin");
}
