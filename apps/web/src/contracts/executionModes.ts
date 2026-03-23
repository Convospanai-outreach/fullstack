export const PRODUCT_MODES = ["outreach", "runtime"] as const;
export type ProductMode = (typeof PRODUCT_MODES)[number];

export const EXECUTION_MODES = ["saas_only", "managed_runtime", "edge_runtime"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const RUNTIME_TARGETS = ["saas_only", "managed_runtime", "edge_runtime"] as const;
export type RuntimeTarget = (typeof RUNTIME_TARGETS)[number];

export const TASK_VERSIONS = {
    v1: 1
} as const;
