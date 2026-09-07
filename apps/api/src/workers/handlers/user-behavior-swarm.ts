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

export function buildDeterministicUserBehaviorReport(role: string, goal: string, metrics: SwarmMetrics, inputSwarmType?: string): UserBehaviorReport {
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

const PRIORITIES = new Set(["P0", "P1", "P2"]);
const SEVERITIES = new Set(["high", "medium", "low"]);
const OWNER_AREAS = new Set(["web", "api", "extension", "docs", "deploy"]);
const CONFIDENCES = new Set(["high", "medium", "low"]);

function parseJsonResponse<T>(raw: string): T {
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(cleaned) as T;
}

function clampString(value: unknown, maxLen: number, fallback: string): string {
    if (typeof value !== "string" || value.trim().length === 0) return fallback;
    return value.trim().slice(0, maxLen);
}

function validateFinding(raw: unknown, personaName: string): UserBehaviorFinding | null {
    if (!raw || typeof raw !== "object") return null;
    const f = raw as Record<string, unknown>;
    const priority = PRIORITIES.has(f.priority as string) ? (f.priority as UserBehaviorFinding["priority"]) : "P1";
    const severity = SEVERITIES.has(f.severity as string) ? (f.severity as UserBehaviorFinding["severity"]) : "medium";
    const ownerArea = OWNER_AREAS.has(f.ownerArea as string) ? (f.ownerArea as UserBehaviorFinding["ownerArea"]) : "web";
    const friction = clampString(f.friction, 400, "");
    if (!friction) return null;

    return {
        scenario: clampString(f.scenario, 160, "Observed friction point"),
        priority,
        severity,
        affectedSurface: clampString(f.affectedSurface, 160, "Unspecified surface"),
        ownerArea,
        friction,
        recommendation: clampString(f.recommendation, 400, "Investigate and address this friction point."),
        testNeeded: clampString(f.testNeeded, 200, "Add coverage for this scenario."),
        persona: personaName,
    };
}

function validateBehaviorReport(raw: unknown, swarmType: BehaviorSwarmType, fallbackPersona: string, fallbackJourney: string[]): UserBehaviorReport | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;

    const persona = clampString(r.persona, 80, fallbackPersona);
    const scenario = clampString(r.scenario, 400, "Simulated persona journey through the current workspace state.");
    const journey = Array.isArray(r.journey) && r.journey.every((step) => typeof step === "string")
        ? (r.journey as string[]).slice(0, 10).map((step) => step.slice(0, 60))
        : fallbackJourney;

    const rawFindings = Array.isArray(r.findings) ? r.findings : [];
    const findings = rawFindings
        .map((f) => validateFinding(f, persona))
        .filter((f): f is UserBehaviorFinding => f !== null)
        .slice(0, 8);
    if (findings.length === 0) return null;

    const frictionScore = typeof r.frictionScore === "number" && Number.isFinite(r.frictionScore)
        ? Math.max(0, Math.min(100, Math.round(r.frictionScore)))
        : Math.min(100, findings.filter((f) => f.severity === "high").length * 35 + findings.filter((f) => f.severity === "medium").length * 18);

    const confidence = CONFIDENCES.has(r.confidence as string) ? (r.confidence as UserBehaviorReport["confidence"]) : "medium";

    const nextBestTests = Array.isArray(r.nextBestTests) && r.nextBestTests.every((t) => typeof t === "string")
        ? (r.nextBestTests as string[]).slice(0, 5).map((t) => t.slice(0, 200))
        : [`Run a browser smoke test for: ${journey.join(" -> ")}`];

    return { swarmType, persona, scenario, journey, frictionScore, confidence, findings, nextBestTests };
}

function buildBehaviorPrompt(role: string, goal: string, metrics: SwarmMetrics, swarmType: BehaviorSwarmType, persona: PersonaDefinition, modeFocus: { scenario: string; journey: string[] }): string {
    return `You are "${role}", a specialist agent simulating a real user's experience inside a B2B outreach SaaS product, for the purpose of finding genuine UX friction before launch.

Persona to simulate: ${persona.persona} — ${persona.scenario}
Mode focus: ${modeFocus.scenario}
Typical journey steps for this mode: ${modeFocus.journey.join(" -> ")}
Operator's stated goal for this run: "${goal}"

Live workspace data for the team being audited (use this to ground your findings — do not invent unrelated data):
- Campaigns: ${metrics.campaigns} (${metrics.activeCampaigns} active)
- Leads: ${metrics.leads}
- Pending approvals: ${metrics.pendingApprovals}

Simulate this persona walking through their journey against a workspace in this exact data state. Identify 2-5 concrete, specific friction points a real person in this persona would hit — not generic SaaS advice, but friction grounded in the actual counts above (e.g. an empty-state, a stuck queue, a confusing next step).

Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{
  "persona": "<persona name>",
  "scenario": "<one sentence describing what this run simulated>",
  "journey": ["<step 1>", "<step 2>", ...],
  "frictionScore": <integer 0-100, higher = more friction>,
  "confidence": "high" | "medium" | "low",
  "findings": [
    {
      "scenario": "<short name for this friction point>",
      "priority": "P0" | "P1" | "P2",
      "severity": "high" | "medium" | "low",
      "affectedSurface": "<route(s) or UI area affected>",
      "ownerArea": "web" | "api" | "extension" | "docs" | "deploy",
      "friction": "<what specifically goes wrong for this persona>",
      "recommendation": "<concrete fix>",
      "testNeeded": "<what test would catch a regression here>"
    }
  ],
  "nextBestTests": ["<test 1>", "<test 2>"]
}`;
}

/**
 * LLM-backed persona simulation. Falls back to the deterministic
 * heuristic report (buildDeterministicUserBehaviorReport) on any LLM
 * failure or malformed response, so a provider outage never breaks the
 * swarm run - it just degrades to the rule-based version.
 */
export async function generateUserBehaviorReport(
    role: string,
    goal: string,
    metrics: SwarmMetrics,
    inputSwarmType: string | undefined,
    teamId: string | null,
    askAI: (prompt: string, teamId?: string, opts?: { expectsJson?: boolean; disableGuardrails?: boolean; taskType?: string; surface?: "CHAT" | "HELPER" | "EMAIL" | "LANDING" | "GENERIC" }) => Promise<string>
): Promise<UserBehaviorReport> {
    const swarmType = normalizeSwarmType(inputSwarmType);
    const persona = pickPersona(role, swarmType);
    const modeFocus = MODE_FOCUS[swarmType];

    try {
        const prompt = buildBehaviorPrompt(role, goal, metrics, swarmType, persona, modeFocus);
        const raw = await askAI(prompt, teamId || undefined, {
            taskType: "AGENT_SWARM_BEHAVIOR",
            surface: "HELPER",
            expectsJson: true,
            disableGuardrails: true
        });
        const parsed = parseJsonResponse<unknown>(raw);
        const validated = validateBehaviorReport(parsed, swarmType, persona.persona, modeFocus.journey);
        if (validated) return validated;
    } catch (error) {
        // Fall through to the deterministic report below.
    }

    return buildDeterministicUserBehaviorReport(role, goal, metrics, inputSwarmType);
}
