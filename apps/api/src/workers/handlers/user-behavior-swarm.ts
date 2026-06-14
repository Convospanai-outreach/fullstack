export type SwarmMetrics = {
    campaigns: number;
    activeCampaigns: number;
    leads: number;
    pendingApprovals: number;
};

export type BehaviorSwarmType = "USER_BEHAVIOR" | "LAUNCH_READINESS" | "LEAD_JOURNEY" | "ADMIN_SETUP";

export type UserBehaviorFinding = {
    scenario: string;
    persona: string;
    priority: "P0" | "P1" | "P2";
    severity: "high" | "medium" | "low";
    affectedSurface: string;
    ownerArea: "web" | "api" | "extension" | "docs" | "deploy";
    friction: string;
    recommendation: string;
    testNeeded: string;
};

export type UserBehaviorReport = {
    swarmType: BehaviorSwarmType;
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

const MODE_FOCUS: Record<BehaviorSwarmType, { scenario: string; journey: string[] }> = {
    USER_BEHAVIOR: {
        scenario: "Simulates how real users move through signup, onboarding, lead capture, outreach, and funnel status updates.",
        journey: ["Signup", "Dashboard", "Lead capture", "Email draft", "LinkedIn capture", "Funnel update"],
    },
    LAUNCH_READINESS: {
        scenario: "Simulates whether a workspace admin can understand what is safe to enable before launch.",
        journey: ["Invite", "Auth sync", "Setup checklist", "Config readiness", "Audit trail", "Team invite"],
    },
    LEAD_JOURNEY: {
        scenario: "Simulates an operator and manager tracking one lead across email, LinkedIn, WhatsApp, call, and follow-up.",
        journey: ["Lead import", "Email sent", "LinkedIn captured", "Manual outreach done", "Follow-up needed", "Pipeline update"],
    },
    ADMIN_SETUP: {
        scenario: "Simulates admin setup of auth, team access, feature exposure, and deployment readiness.",
        journey: ["Clerk access", "Invite approval", "Team settings", "Feature readiness", "Governance", "Launch checklist"],
    },
};

function normalizeSwarmType(value?: string): BehaviorSwarmType {
    if (value === "LAUNCH_READINESS" || value === "LEAD_JOURNEY" || value === "ADMIN_SETUP") return value;
    return "USER_BEHAVIOR";
}

function pickPersona(role: string, swarmType: BehaviorSwarmType) {
    const normalized = role.toLowerCase();
    if (swarmType === "LAUNCH_READINESS" || swarmType === "ADMIN_SETUP") return PERSONAS[3]!;
    if (swarmType === "LEAD_JOURNEY") return normalized.includes("manager") || normalized.includes("revops") ? PERSONAS[2]! : PERSONAS[1]!;
    if (normalized.includes("operator")) return PERSONAS[1]!;
    if (normalized.includes("manager") || normalized.includes("revops") || normalized.includes("product")) return PERSONAS[2]!;
    if (normalized.includes("admin") || normalized.includes("auditor")) return PERSONAS[3]!;
    return PERSONAS[0]!;
}

function confidenceFor(metrics: SwarmMetrics): "high" | "medium" | "low" {
    if (metrics.leads > 0 && metrics.campaigns > 0) return "high";
    if (metrics.leads > 0 || metrics.campaigns > 0) return "medium";
    return "low";
}

function createFinding(input: Omit<UserBehaviorFinding, "persona">, persona: string): UserBehaviorFinding {
    return { ...input, persona };
}

export function buildUserBehaviorReport(role: string, goal: string, metrics: SwarmMetrics, inputSwarmType?: string): UserBehaviorReport {
    const swarmType = normalizeSwarmType(inputSwarmType);
    const persona = pickPersona(role, swarmType);
    const modeFocus = MODE_FOCUS[swarmType];
    const findings: UserBehaviorFinding[] = [];

    if (metrics.campaigns === 0) {
        findings.push(createFinding({
            scenario: "First campaign activation",
            priority: "P0",
            severity: "high",
            affectedSurface: "/campaigns, /dashboard",
            ownerArea: "web",
            friction: "No campaigns exist, so a new user cannot prove the email-to-funnel workflow end to end.",
            recommendation: "Add a guided sample campaign or checklist step that gets the user to a review-ready draft.",
            testNeeded: "Unit or integration test for empty campaign dashboard CTA.",
        }, persona.persona));
    }

    if (metrics.leads === 0) {
        findings.push(createFinding({
            scenario: "Lead journey start",
            priority: "P0",
            severity: "high",
            affectedSurface: "/leads, /dashboard",
            ownerArea: "web",
            friction: "No leads exist, so the user cannot see channel badges, journey updates, or stale-lead suggestions.",
            recommendation: "Seed a safe demo lead or make import/capture the dominant empty-state action.",
            testNeeded: "Unit or integration test for empty lead-table primary action.",
        }, persona.persona));
    }

    if (metrics.activeCampaigns === 0 && metrics.campaigns > 0) {
        findings.push(createFinding({
            scenario: "Draft-to-active handoff",
            priority: "P1",
            severity: "medium",
            affectedSurface: "/campaigns, approval queue",
            ownerArea: "web",
            friction: "Campaigns exist but none are active, which can make the next step unclear after drafting.",
            recommendation: "Show a review queue CTA that explains what approval is needed before outreach tracking starts.",
            testNeeded: "Regression test for campaign draft state next-step copy.",
        }, persona.persona));
    }

    if (metrics.pendingApprovals > 5) {
        findings.push(createFinding({
            scenario: "Approval queue load",
            priority: "P1",
            severity: "medium",
            affectedSurface: "/approvals, /dashboard",
            ownerArea: "web",
            friction: "Many pending approvals can hide the most urgent user action.",
            recommendation: "Sort approvals by age and funnel impact, then surface the top three actions on the dashboard.",
            testNeeded: "Unit test for approval prioritization and dashboard summary ordering.",
        }, persona.persona));
    }

    if (swarmType === "LAUNCH_READINESS" || swarmType === "ADMIN_SETUP") {
        findings.push(createFinding({
            scenario: "Auth and configuration confidence",
            priority: "P1",
            severity: "medium",
            affectedSurface: "Clerk sync, setup checklist, deploy env",
            ownerArea: "deploy",
            friction: "Admin confidence depends on knowing Clerk auth, Postgres sync, and required environment variables are all ready.",
            recommendation: "Show a launch readiness checklist for Clerk, DATABASE_URL, DIRECT_URL, email provider, and optional channels.",
            testNeeded: "Guard or integration test proving Clerk sync plus disabled password signup.",
        }, persona.persona));
    }

    if (swarmType === "LEAD_JOURNEY") {
        findings.push(createFinding({
            scenario: "Multi-channel status continuity",
            priority: metrics.leads === 0 ? "P0" : "P1",
            severity: metrics.leads === 0 ? "high" : "medium",
            affectedSurface: "/leads, lead detail, journey API",
            ownerArea: "api",
            friction: "The same person must remain one lead while email, LinkedIn, WhatsApp, and call activities update channel status.",
            recommendation: "Keep one lead record, show channel badges, and require manual confirmation before marking outreach done.",
            testNeeded: "Integration test for email plus LinkedIn status updates on one lead.",
        }, persona.persona));
    }

    if (findings.length === 0) {
        findings.push(createFinding({
            scenario: "Happy-path continuity",
            priority: "P2",
            severity: "low",
            affectedSurface: "Dashboard, lead detail, setup flow",
            ownerArea: "web",
            friction: "No obvious data-state blockers were detected from current counts.",
            recommendation: "Run browser-level checks for copy clarity, mobile layout, and manual journey update ergonomics.",
            testNeeded: "Optional browser smoke test for the full persona journey.",
        }, persona.persona));
    }

    const highFindings = findings.filter((finding) => finding.severity === "high").length;
    const mediumFindings = findings.filter((finding) => finding.severity === "medium").length;
    const frictionScore = Math.min(100, highFindings * 35 + mediumFindings * 18 + Math.max(0, findings.length - highFindings - mediumFindings) * 6);

    return {
        swarmType,
        persona: persona.persona,
        scenario: `${modeFocus.scenario} ${persona.scenario}`,
        journey: modeFocus.journey,
        frictionScore,
        confidence: confidenceFor(metrics),
        findings,
        nextBestTests: [
            `Run a browser smoke test for: ${modeFocus.journey.join(" -> ")}`,
            `Validate the goal "${goal}" against empty, partial, and active workspace states.`,
            "Confirm the user can recover without support when a field or channel status is missing.",
        ],
    };
}
