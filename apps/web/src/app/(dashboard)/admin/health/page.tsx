import { requireRole, SUPER_ADMIN_ROLES } from "@/lib/auth";
import HealthClient from "./HealthClient";

// Platform infrastructure health is SYSTEM_ADMIN-only (roadmap.md item 2.7 /
// S-05); the underlying /admin/runtime-overview API enforces the same, this
// gate just avoids showing ORG_ADMINs a shell they can't populate.
export default async function AdminHealthPage() {
    await requireRole([...SUPER_ADMIN_ROLES]);
    return <HealthClient />;
}
