import { requireRole, SUPER_ADMIN_ROLES } from "@/lib/auth";
import ClientErrorsClient from "./ClientErrorsClient";

// Cross-tenant client error payloads are SYSTEM_ADMIN-only (roadmap.md item
// 2.7 / S-05); the underlying /admin/client-errors API enforces the same, this
// gate just avoids showing ORG_ADMINs a shell they can't populate.
export default async function ClientErrorsPage() {
    await requireRole([...SUPER_ADMIN_ROLES]);
    return <ClientErrorsClient />;
}
