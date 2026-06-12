import { PIPELINE_LABELS, PIPELINE_STAGES } from "./leadStageTransitions";

export type FunnelGroup = {
    pipelineState: string | null;
    _count: { id: number };
};

export function normalizeFunnel(groups: FunnelGroup[]) {
    const counts = new Map(groups.map((group) => [group.pipelineState || "COLD", group._count.id]));
    const total = PIPELINE_STAGES.reduce((sum, stage) => sum + (counts.get(stage) || 0), 0);

    return PIPELINE_STAGES.map((stage) => {
        const count = counts.get(stage) || 0;
        return {
            key: stage,
            label: PIPELINE_LABELS[stage],
            count,
            percentageOfTotal: total > 0 ? Math.round((count / total) * 100) : 0
        };
    });
}
