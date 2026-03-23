import { prisma } from "@/lib/db";
import { ExecutionMode } from "@/contracts/executionModes";
import { HybridRouter } from "@/lib/ai/HybridRouter";

export async function resolveExecutionMode(teamId: string): Promise<ExecutionMode> {
    const policy = await prisma.organizationPolicy.findUnique({
        where: { organizationId: teamId },
        select: { executionMode: true }
    });
    const mode = (policy?.executionMode || "saas_only") as ExecutionMode;
    return mode;
}

export async function resolveRuntimeEndpoint(teamId: string, userId?: string): Promise<{ mode: ExecutionMode; endpoint?: string }> {
    const mode = await resolveExecutionMode(teamId);
    if (mode === "managed_runtime") {
        const endpoint = process.env["MANAGED_RUNTIME_URL"] || process.env["NEXT_PUBLIC_RUNTIME_API_URL"];
        return endpoint ? { mode, endpoint } : { mode };
    }
    if (mode === "edge_runtime") {
        const endpoint = await HybridRouter.getEndpoint("ON_PREM" as any, userId);
        return endpoint ? { mode, endpoint } : { mode };
    }
    return { mode };
}
