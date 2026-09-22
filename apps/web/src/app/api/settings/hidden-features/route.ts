import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentContext } from "@/lib/auth";
import {
    getDefaultEnabledHiddenFeatureKeys,
    HiddenFeatureKey,
    HIDDEN_FEATURES,
    HIDDEN_FEATURES_COOKIE,
    mergeEnabledHiddenFeatureKeys,
    parseEnabledHiddenFeatureKeys,
    serializeEnabledHiddenFeatureKeys,
} from "@/lib/productFlags";
import {
    loadFeatureContext,
    resolveEnabledFeatureKeysFromContext,
    resolveReadiness,
} from "@/lib/hiddenFeaturesReadiness";

// Best-effort: mirror the DB-resolved enabled set into the client cookie so the
// proxy middleware gate (discoverability only, not a security boundary) stays in
// sync without a per-request DB read. Never allowed to throw - a cookie-write
// failure must not 500 the GET and blank every user's sidebar.
async function seedEnabledFeaturesCookie(enabledFeatures: Set<HiddenFeatureKey>) {
    try {
        const cookieStore = await cookies();
        cookieStore.set({
            name: HIDDEN_FEATURES_COOKIE,
            value: serializeEnabledHiddenFeatureKeys(enabledFeatures),
            httpOnly: false,
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
            sameSite: "lax",
            secure: process.env["NODE_ENV"] === "production",
        });
    } catch (error) {
        console.warn("[settings:hidden-features] cookie seed skipped", error);
    }
}

// Last-known-good enabled set for the degraded/fallback paths: the cookie holds the
// DB-resolved set the previous successful GET seeded, so a transient context failure
// (DB blip, session race) doesn't wipe the sidebar back to nothing. Env override unioned
// in. No DB read; never throws.
async function lastKnownEnabledFeatures(): Promise<Set<HiddenFeatureKey>> {
    try {
        const cookieStore = await cookies();
        return mergeEnabledHiddenFeatureKeys(
            getDefaultEnabledHiddenFeatureKeys(),
            parseEnabledHiddenFeatureKeys(cookieStore.get(HIDDEN_FEATURES_COOKIE)?.value)
        );
    } catch {
        return getDefaultEnabledHiddenFeatureKeys();
    }
}

export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json(
                buildFallbackFeatures("No active workspace was found for this account.", await lastKnownEnabledFeatures())
            );
        }

        const context = await loadFeatureContext(teamId);
        const enabledFeatures = resolveEnabledFeatureKeysFromContext(context);
        await seedEnabledFeaturesCookie(enabledFeatures);

        const features = Object.values(HIDDEN_FEATURES).map((feature) => {
            const readiness = resolveReadiness(feature.key, context);
            return {
                ...feature,
                enabled: enabledFeatures.has(feature.key),
                ready: readiness.ready,
                readinessReason: readiness.reason,
                recommendedAction: readiness.action,
            };
        });

        return NextResponse.json({
            defaults: Array.from(enabledFeatures),
            features,
        });
    } catch (error: any) {
        console.error("[settings:hidden-features:get]", error);
        return NextResponse.json(
            buildFallbackFeatures("Readiness checks are temporarily unavailable.", await lastKnownEnabledFeatures())
        );
    }
}

function buildFallbackFeatures(reason: string, enabled: Set<HiddenFeatureKey>) {
    const features = Object.values(HIDDEN_FEATURES).map((feature) => ({
        ...feature,
        enabled: enabled.has(feature.key),
        ready: false,
        readinessReason: reason,
        recommendedAction: "Try again after the workspace finishes setup.",
    }));

    return {
        defaults: Array.from(enabled),
        features,
        degraded: true,
        errorCode: "HIDDEN_FEATURE_CONTEXT_FAILED",
    };
}

export async function PUT(req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const requestedKeys = Array.isArray(body?.enabledFeatures) ? body.enabledFeatures : [];
        const enabledFeatures = serializeEnabledHiddenFeatureKeys(
            requestedKeys
                .map((value: string) => typeof value === "string" ? value.trim().toLowerCase() : "")
                .filter((value: string): value is HiddenFeatureKey => Boolean(value) && value in HIDDEN_FEATURES)
                .map((value: HiddenFeatureKey) => value)
        );

        // Source of truth: per-team DB row, shared across members. This first save
        // also freezes whatever readiness produced into an explicit array, so the
        // team stops tracking readiness after customizing (explicit beats inference).
        const enabledArray = enabledFeatures ? enabledFeatures.split(",") : [];
        const { prisma } = await import("@/lib/db");
        await prisma.team.update({
            where: { id: teamId },
            data: { enabledFeatures: enabledArray },
        });

        // Cache into the cookie for the proxy gate (best-effort, same as GET).
        const cookieStore = await cookies();
        cookieStore.set({
            name: HIDDEN_FEATURES_COOKIE,
            value: enabledFeatures,
            httpOnly: false,
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
            sameSite: "lax",
            secure: process.env["NODE_ENV"] === "production",
        });

        return NextResponse.json({
            ok: true,
            enabledFeatures: enabledArray,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Failed to update hidden features" }, { status: 500 });
    }
}
