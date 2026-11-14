import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { checkSmtpDomainAuth } from "@/modules/email-campaigner/service/smtpDomainAuth";
import { DnsUnavailableError } from "@/modules/email-campaigner/service/dnsLookup";

const Schema = z.object({
    domain: z.string().min(3).max(253),
    selector: z.string().min(1).max(63).optional(),
    spfInclude: z.string().min(1).max(200).optional(),
});

// DNS readiness for a domain sent through the team's own SMTP server. Reads public DNS only.
export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContextFromRequest(req);
        if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }
        const parsed = Schema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
        return NextResponse.json({ result: await checkSmtpDomainAuth(parsed.data) });
    } catch (error: any) {
        if (error instanceof DnsUnavailableError) {
            return NextResponse.json({ error: "DNS did not answer just now. Try again in a minute." }, { status: 503 });
        }
        const message = typeof error?.message === "string" ? error.message : "";
        const clientError = message.startsWith("Enter a valid");
        return NextResponse.json({ error: clientError ? message : "Unable to check DNS records." }, { status: clientError ? 400 : 500 });
    }
}
