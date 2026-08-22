import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { UserRole } from "@/types/prisma-safe";

export default async function AdminRootPage() {
    await requireRole([UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN]);
    redirect("/admin/super");
}
