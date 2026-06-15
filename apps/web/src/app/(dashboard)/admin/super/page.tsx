import { requireRole } from "@/lib/auth";
import { UserRole } from "@/types/prisma-safe";
import SuperAdminDashboardClient from "./SuperAdminDashboardClient";

export default async function SuperAdminPage() {
    await requireRole([UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN]);
    return <SuperAdminDashboardClient />;
}
