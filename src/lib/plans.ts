export enum Plan {
    FREE = "FREE",
    PRO = "PRO",
    ENTERPRISE = "ENTERPRISE"
}

export const PLAN_FEATURES = {
    [Plan.FREE]: {
        agents: 1,
        automations: false,
        analytics: "basic",
        team: false
    },
    [Plan.PRO]: {
        agents: 5,
        automations: true,
        analytics: "advanced",
        team: false
    },
    [Plan.ENTERPRISE]: {
        agents: 999,
        automations: true,
        analytics: "advanced",
        team: true
    }
};

export const PLAN_LEVELS: Record<string, number> = {
    [Plan.FREE]: 0,
    [Plan.PRO]: 1,
    [Plan.ENTERPRISE]: 2,
    // Fallback for lowercase if DB has mixed case
    "free": 0,
    "pro": 1,
    "enterprise": 2
};

export function isPlanEligible(userPlan: string, requiredPlan: Plan): boolean {
    const normalizedUserPlan = userPlan?.toUpperCase() || "FREE";
    const userLevel = PLAN_LEVELS[normalizedUserPlan] ?? 0;
    const requiredLevel = PLAN_LEVELS[requiredPlan];
    return userLevel >= requiredLevel;
}
