import { requireRole, SUPER_ADMIN_ROLES } from "@/lib/auth";
import AiAnalyticsClient from "./AiAnalyticsClient";

// LLM performance metrics are platform-wide (AiTrace has no teamId) and served
// by the SYSTEM_ADMIN-only /admin/llm-stats route (roadmap.md item 2.7 / S-05);
// this gate keeps ORG_ADMINs off a shell they can't populate.
export default async function AIPerformancePage() {
    await requireRole([...SUPER_ADMIN_ROLES]);
    return <AiAnalyticsClient />;
}
