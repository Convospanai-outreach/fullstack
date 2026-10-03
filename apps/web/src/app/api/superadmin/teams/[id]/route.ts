import { NextRequest, NextResponse } from "next/server";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";
import { HIDDEN_FEATURES, type HiddenFeatureKey } from "@/lib/productFlags";

const POLICY_SELECT = {
    productMode: true,
    productSurface: true,
    maxDailyActions: true,
    maxCampaigns: true,
    maxAgents: true,
    maxCreditsPerUser: true,
    allowInMail: true,
    allowScraping: true,
    allowUploads: true,
    requiresApprovalForCampaign: true,
    requiresApprovalForOverage: true,
    detectPII: true,
} as const;

const PRODUCT_MODES = ["ENTERPRISE_CORE", "GROWTH", "ALL_FEATURES"] as const;
const PRODUCT_SURFACES = ["outreach", "runtime"];
const LIMIT_FIELDS = ["maxDailyActions", "maxCampaigns", "maxAgents", "maxCreditsPerUser"] as const;
const SWITCH_FIELDS = ["allowInMail", "allowScraping", "allowUploads", "requiresApprovalForCampaign", "requiresApprovalForOverage", "detectPII"] as const;

async function teamState(teamId: string) {
    const { prisma } = await import("@/lib/db");
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true, enabledFeatures: true } });
    if (!team) return null;
    const [policy, { resolveEnabledFeatureKeys }] = await Promise.all([
        prisma.organizationPolicy.findUnique({ where: { organizationId: teamId }, select: POLICY_SELECT }),
        import("@/lib/hiddenFeaturesReadiness"),
    ]);
    return {
        id: team.id,
        name: team.name,
        // null = the team never customized, so readiness decides.
        storedFeatures: Array.isArray(team.enabledFeatures) ? team.enabledFeatures.map(String) : null,
        effectiveFeatures: Array.from(await resolveEnabledFeatureKeys(teamId)),
        policy,
    };
}

// One team's optional features and policy (product mode, limits, switches).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const state = await teamState((await params).id);
    return state ? NextResponse.json(state) : NextResponse.json({ error: "Team not found" }, { status: 404 });
}

// { enabledFeatures?: string[] | null, policy?: {...} }. enabledFeatures null resets the
// team to readiness-based defaults.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const teamId = (await params).id;
    const before = await teamState(teamId);
    if (!before) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const input = (await req.json().catch(() => null)) as { enabledFeatures?: unknown; policy?: Record<string, unknown> } | null;
    if (!input) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    let features: HiddenFeatureKey[] | null | undefined;
    if (input.enabledFeatures === null) features = null;
    else if (input.enabledFeatures !== undefined) {
        if (!Array.isArray(input.enabledFeatures) || input.enabledFeatures.some((key) => typeof key !== "string" || !(key in HIDDEN_FEATURES))) {
            return NextResponse.json({ error: "enabledFeatures must be a list of known feature keys, or null" }, { status: 400 });
        }
        features = Array.from(new Set(input.enabledFeatures as HiddenFeatureKey[]));
    }

    const policy: {
        productMode?: (typeof PRODUCT_MODES)[number];
        productSurface?: string;
    } & Partial<Record<(typeof LIMIT_FIELDS)[number], number>> &
        Partial<Record<(typeof SWITCH_FIELDS)[number], boolean>> = {};
    if (input.policy !== undefined) {
        const p = input.policy;
        if (!p || typeof p !== "object") return NextResponse.json({ error: "policy must be an object" }, { status: 400 });
        if (p["productMode"] !== undefined) {
            const mode = PRODUCT_MODES.find((m) => m === p["productMode"]);
            if (!mode) return NextResponse.json({ error: "Unknown product mode" }, { status: 400 });
            policy.productMode = mode;
        }
        if (p["productSurface"] !== undefined) {
            if (!PRODUCT_SURFACES.includes(String(p["productSurface"]))) return NextResponse.json({ error: "Unknown product surface" }, { status: 400 });
            policy.productSurface = String(p["productSurface"]);
        }
        for (const field of LIMIT_FIELDS) {
            if (p[field] === undefined) continue;
            const value = p[field];
            if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 1_000_000) {
                return NextResponse.json({ error: `${field} must be a whole number from 0 to 1000000` }, { status: 400 });
            }
            policy[field] = value;
        }
        for (const field of SWITCH_FIELDS) {
            if (p[field] === undefined) continue;
            if (typeof p[field] !== "boolean") return NextResponse.json({ error: `${field} must be true or false` }, { status: 400 });
            policy[field] = p[field] as boolean;
        }
    }

    const { prisma } = await import("@/lib/db");
    if (features !== undefined) {
        if (features === null) {
            // Back to "never customized" (a SQL NULL, which readiness defaults key off).
            await prisma.$executeRaw`UPDATE "Team" SET "enabledFeatures" = NULL WHERE id = ${teamId}`;
        } else {
            await prisma.team.update({ where: { id: teamId }, data: { enabledFeatures: features } });
        }
        await auditSuperAdmin(actor, "TEAM_FEATURES_SET", req, { teamId, before: before.storedFeatures, after: features });
    }
    if (Object.keys(policy).length > 0) {
        await prisma.organizationPolicy.upsert({
            where: { organizationId: teamId },
            create: { organizationId: teamId, ...policy },
            update: policy,
        });
        await auditSuperAdmin(actor, "TEAM_POLICY_SET", req, { teamId, before: before.policy, changes: policy });
    }
    return NextResponse.json(await teamState(teamId));
}
