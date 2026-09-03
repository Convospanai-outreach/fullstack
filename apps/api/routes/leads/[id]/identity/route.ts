import { NextResponse } from "next/server";
import { DbFactory } from "@/lib/dbFactory";
import { IdentityService } from "@/lib/identity/IdentityService";
import { getCurrentContextFromRequest } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { teamId } = await getCurrentContextFromRequest(req);
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const prisma = DbFactory.getClient('GLOBAL'); // Start with Global

        // 1. Try finding a Lead first (Standard Flow) - scoped by the caller's own
        // teamId, not just id, so a guessed/enumerated id from another team can't
        // be used to de-mask that team's PII through this endpoint.
        let lead = await prisma.lead.findFirst({
            where: { id, teamId },
            select: { id: true, regionId: true, email: true, phone: true }
        });

        // Check UAE if not found globally
        if (!lead && process.env['UAE_DATABASE_URL']) {
            const uaeClient = DbFactory.getClient('UAE');
            lead = await uaeClient.lead.findFirst({
                where: { id, teamId },
                select: { id: true, regionId: true, email: true, phone: true }
            });
        }

        if (lead) {
            // ... Unmasking logic for Lead ...
            let revealedEmail = lead.email;
            let revealedPhone = lead.phone;

            if (lead.email && lead.email.startsWith("[")) {
                const original = await IdentityService.reidentify(lead.email, lead.regionId);
                if (original) revealedEmail = original;
            }
            if (lead.phone && lead.phone.startsWith("[")) {
                const original = await IdentityService.reidentify(lead.phone, lead.regionId);
                if (original) revealedPhone = original;
            }
            return NextResponse.json({
                id: lead.id,
                email: revealedEmail,
                phone: revealedPhone,
                isMasked: false
            });
        }

        // 2. Fallback: Try Finding a ScrapingJob (Draft Flow) - same team scoping.
        let job = await prisma.scrapingJob.findFirst({ where: { id, teamId } });
        if (!job && process.env['UAE_DATABASE_URL']) {
            const uaeClient = DbFactory.getClient('UAE');
            job = await uaeClient.scrapingJob.findFirst({ where: { id, teamId } });
        }

        if (job) {
            const tokenMap = job.tokenMap as Record<string, string>;
            const revealedData: Record<string, string> = {};

            if (tokenMap) {
                const tokens = Object.keys(tokenMap);
                // Limit to prevent abuse/excessive calls
                for (const token of tokens.slice(0, 5)) {
                    const original = await IdentityService.reidentify(token, job.region);
                    if (original) revealedData[token] = original;
                }
            }

            // Extract heuristic email/phone from revealed data
            const email = Object.values(revealedData).find(v => v.includes("@"));
            const name = Object.values(revealedData).find(v => !v.includes("@") && v.length > 3);

            return NextResponse.json({
                id: job.id,
                email: email || "Attached to Vault",
                name: name || "Verified Person",
                revealedDetails: revealedData,
                isMasked: false
            });
        }

        return NextResponse.json({ error: "Identity not found" }, { status: 404 });

    } catch (error: any) {
        console.error("[IdentityProxy] Failed to resolve identity:", error);
        return NextResponse.json({ error: "Identity Resolution Failed" }, { status: 500 });
    }
}
