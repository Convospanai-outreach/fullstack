import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import {
    ensureResendDomainVerified,
    removeResendDomain,
    updateResendDomainTracking,
} from "@/modules/email-campaigner/service/resendDomainService";
import { z } from "zod";

const DomainCheckSchema = z.object({
    domain: z.string().min(3).max(253),
});

const DomainTrackingUpdateSchema = z.object({
    domain: z.string().min(3).max(253),
    openTracking: z.boolean().optional(),
    clickTracking: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const body = await req.json();
        const parsed = DomainCheckSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
        }

        const result = await ensureResendDomainVerified({
            teamId: ctx.teamId,
            domain: parsed.data.domain,
        });
        return NextResponse.json({ result });
    } catch (error: any) {
        // normalizeDomain() throws this for a syntactically invalid domain (e.g.
        // "abc" passes the schema's min(3) check but isn't a real domain) - that's
        // a client input error, not a server failure.
        const status = error?.message?.startsWith("Enter a valid domain") ? 400 : 500;
        return NextResponse.json({ error: error?.message || "Unable to check this domain with Resend." }, { status });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const body = await req.json();
        const parsed = DomainTrackingUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
        }

        const result = await updateResendDomainTracking({
            teamId: ctx.teamId,
            domain: parsed.data.domain,
            openTracking: parsed.data.openTracking,
            clickTracking: parsed.data.clickTracking,
        });
        return NextResponse.json({ result });
    } catch (error: any) {
        const status = error?.message?.startsWith("Enter a valid domain") || error?.message?.startsWith("Provide at least one")
            ? 400
            : error?.message?.startsWith("No Resend domain check found")
                ? 404
                : 500;
        return NextResponse.json({ error: error?.message || "Unable to update this domain's tracking settings." }, { status });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const domain = searchParams.get("domain");
        if (!domain) {
            return NextResponse.json({ error: "domain query parameter is required" }, { status: 400 });
        }

        const result = await removeResendDomain({ teamId: ctx.teamId, domain });
        return NextResponse.json({ result });
    } catch (error: any) {
        const status = error?.message?.startsWith("Enter a valid domain")
            ? 400
            : error?.message?.startsWith("No Resend domain check found")
                ? 404
                : 500;
        return NextResponse.json({ error: error?.message || "Unable to remove this domain from Resend." }, { status });
    }
}
