export type SwarmMetrics = {
    campaigns: number;
    activeCampaigns: number;
    leads: number;
    pendingApprovals: number;
};

export type UserBehaviorFinding = {
    scenario: string;
    persona: string;
    severity: "high" | "medium" | "low";
    friction: string;
    recommendation: string;
};

export type UserBehaviorReport = {
    persona: string;
    scenario: string;
    journey: string[];
    frictionScore: number;
    confidence: "high" | "medium" | "low";
    findings: UserBehaviorFinding[];
    nextBestTests: string[];
};

type PersonaDefinition = {
    persona: string;
    scenario: string;
    journey: string[];
};

const PERSONAS: PersonaDefinition[] = [
    {
        persona: "First-time founder",
        scenario: "Signs up, requests access, reaches the first dashboard, and tries to understand what to do next.",
        journey: ["Signup", "Invite approval", "Dashboard", "Setup checklist", "First lead action"],
    },
    {
        persona: "Sales operator",
        scenario: "Imports leads, drafts email outreach, captures LinkedIn context, and updates channel status.",
        journey: ["Lead import", "Email draft", "LinkedIn capture", "Journey update", "Follow-up review"],
    },
    {
        persona: "RevOps manager",
        scenario: "Reviews funnel progress, channel badges, stale leads, and assistant suggestions.",
        journey: ["Dashboard", "Lead table", "Lead detail", "Assistant suggestions", "Pipeline view"],
    },
    {
        persona: "Workspace admin",
        scenario: "Checks invite flow, permissions, auditability, and launch readiness before letting the team use it.",
        journey: ["Invite requests", "Team settings", "Audit trail", "Feature readiness", "Governance checks"],
    },
];

function pickPersona(role: string) {
    const normalized = role.toLowerCase();
    if (normalized.includes("operator")) return PERSONAS[1]!;
    if (normalized.includes("manager") || normalized.includes("revops") || normalized.includes("product")) return PERSONAS[2]!;
    if (normalized.includes("admin") || normalized.includes("auditor")) return PERSONAS[3]!;
    return PERSONAS[0]!;
}

function severityFor(score: number): "high" | "medium" | "low" {
    if (score >= 70) return "high";
    if (score >= 40) return "medium";
    return "low";
}

function confidenceFor(metrics: SwarmMetrics): "high" | "medium" | "low" {
    if (metrics.leads > 0 && metrics.campaigns > 0) return "high";
    if (metrics.leads > 0 || metrics.campaigns > 0) return "medium";
    return "low";
}

export function buildUserBehaviorReport(role: string, goal: string, metrics: SwarmMetrics): UserBehaviorReport {
    const persona = pickPersona(role);
    const findings: UserBehaviorFinding[] = [];

    if (metrics.campaigns === 0) {
        findings.push({
            scenario: "First campaign activation",
            persona: persona.persona,
            severity: "high",
            friction: "No campaigns exist, so a new user cannot prove the email-to-funnel workflow end to end.",
            recommendation: "Add a guided sample campaign or checklist step that gets the user to a review-ready draft.",
        });
    }

    if (metrics.leads === 0) {
        findings.push({
            scenario: "Lead journey start",
            persona: persona.persona,
            severity: "high",
            friction: "No leads exist, so the user cannot see channel badges, journey updates, or stale-lead suggestions.",
            recommendation: "Seed a safe demo lead or make import/capture the dominant empty-state action.",
        });
    }

    if (metrics.activeCampaigns === 0 && metrics.campaigns > 0) {
        findings.push({
            scenario: "Draft-to-active handoff",
            persona: persona.persona,
            severity: "medium",
            friction: "Campaigns exist but none are active, which can make the next step unclear after drafting.",
            recommendation: "Show a review queue CTA that explains what approval is needed before outreach tracking starts.",
        });
    }

    if (metrics.pendingApprovals > 5) {
        findings.push({
            scenario: "Approval queue load",
            persona: persona.persona,
            severity: "medium",
            friction: "Many pending approvals can hide the most urgent user action.",
            recommendation: "Sort approvals by age and funnel impact, then surface the top three actions on the dashboard.",
        });
    }

    if (findings.length === 0) {
        findings.push({
            scenario: "Happy-path continuity",
            persona: persona.persona,
            severity: "low",
            friction: "No obvious data-state blockers were detected from current counts.",
            recommendation: "Run browser-level checks for copy clarity, mobile layout, and manual journey update ergonomics.",
        });
    }

    const highFindings = findings.filter((finding) => finding.severity === "high").length;
    const mediumFindings = findings.filter((finding) => finding.severity === "medium").length;
    const frictionScore = Math.min(100, highFindings * 35 + mediumFindings * 18 + Math.max(0, findings.length - highFindings - mediumFindings) * 6);

    return {
        persona: persona.persona,
        scenario: persona.scenario,
        journey: persona.journey,
        frictionScore,
        confidence: confidenceFor(metrics),
        findings: findings.map((finding) => ({
            ...finding,
            severity: finding.severity || severityFor(frictionScore),
        })),
        nextBestTests: [
            `Run a browser smoke test for: ${persona.journey.join(" -> ")}`,
            `Validate the goal "${goal}" against empty, partial, and active workspace states.`,
            "Confirm the user can recover without support when a field or channel status is missing.",
        ],
    };
}
