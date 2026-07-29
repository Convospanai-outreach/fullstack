/**
 * Backfill script: Find leads stuck in DRAFT_READY with an Email draft
 * but no corresponding ApprovalRequest, and create the missing approval rows.
 *
 * Usage: npx tsx scripts/backfill-orphaned-drafts.ts [--dry-run]
 *
 * --dry-run: Only report orphaned drafts, don't create ApprovalRequests.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// Load environment variables from repo root, apps/web, or apps/api .env
const envPaths = [".env", "apps/web/.env", "apps/api/.env", "apps/web/.env.local"];
for (const p of envPaths) {
    const fullPath = path.resolve(process.cwd(), p);
    if (fs.existsSync(fullPath)) {
        dotenv.config({ path: fullPath });
    }
}
if (!process.env["DATABASE_URL"]) {
    process.env["DATABASE_URL"] = "postgresql://postgres:postgres@127.0.0.1:5432/craftmyfunnel?schema=public";
}

import { prisma } from "../apps/web/src/lib/db";

async function main() {
    const dryRun = process.argv.includes("--dry-run");

    console.log(`[backfill-orphaned-drafts] Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);

    const totalLeads = await prisma.lead.count();
    const draftReadyLeads = await prisma.lead.findMany({
        where: { status: "DRAFT_READY" },
        select: { id: true, email: true, fullName: true, status: true },
    });
    const totalEmails = await prisma.email.count();
    const draftEmails = await prisma.email.findMany({
        where: { status: "draft" },
        select: { id: true, leadId: true, campaignId: true, subject: true },
    });
    const totalApprovals = await prisma.approvalRequest.count();

    console.log(`[backfill-orphaned-drafts] DB Summary:`);
    console.log(`  - Total Leads: ${totalLeads} | DRAFT_READY Leads: ${draftReadyLeads.length}`);
    for (const l of draftReadyLeads) {
        console.log(`    • Lead ${l.id} (${l.fullName || l.email || "unnamed"}) -> Status: ${l.status}`);
    }
    console.log(`  - Total Emails: ${totalEmails} | Draft Status Emails: ${draftEmails.length}`);
    console.log(`  - Total ApprovalRequests: ${totalApprovals}`);

    // Find all Email rows with status "draft"
    const orphanedDrafts = await prisma.email.findMany({
        where: {
            status: "draft",
        },
        include: {
            lead: { select: { id: true, email: true, fullName: true, status: true, teamId: true } },
            campaign: { select: { id: true, name: true, teamId: true, ownerId: true } },
        },
    });

    // Filter to only those without an existing ApprovalRequest
    const trulyOrphaned = [];
    for (const email of orphanedDrafts) {
        const existingApproval = await prisma.approvalRequest.findFirst({
            where: {
                entityType: "Email",
                entityId: email.id,
                actionType: "SEND_EMAIL_DRAFT",
            },
            select: { id: true },
        });
        if (!existingApproval) {
            trulyOrphaned.push(email);
        }
    }

    console.log(`[backfill-orphaned-drafts] Found ${trulyOrphaned.length} orphaned draft(s) with no ApprovalRequest`);

    if (trulyOrphaned.length === 0) {
        console.log("[backfill-orphaned-drafts] Nothing to backfill. All draft emails have approval requests.");
        return;
    }

    for (const email of trulyOrphaned) {
        const teamId = email.campaign?.teamId || email.lead?.teamId;
        const requesterId = email.campaign?.ownerId;
        const leadName = email.lead?.email || email.lead?.fullName || "unknown lead";
        const campaignName = email.campaign?.name || "unknown campaign";

        console.log(`  → Email ${email.id} | Lead: ${leadName} | Campaign: ${campaignName} | Team: ${teamId || "none"}`);

        if (!teamId) {
            console.log(`    ⚠️ Skipping: No teamId found for email ${email.id}`);
            continue;
        }

        let resolvedRequesterId = requesterId;
        if (!resolvedRequesterId) {
            const teamUser = await prisma.user.findFirst({
                where: { memberships: { some: { teamId } } },
                select: { id: true },
            });
            resolvedRequesterId = teamUser?.id;
        }

        if (!resolvedRequesterId) {
            console.log(`    ⚠️ Skipping: No valid requester user found for team ${teamId}`);
            continue;
        }

        if (dryRun) {
            console.log(`    [DRY RUN] Would create ApprovalRequest for email ${email.id}`);
            continue;
        }

        const approval = await prisma.approvalRequest.create({
            data: {
                teamId,
                requesterId: resolvedRequesterId,
                actionType: "SEND_EMAIL_DRAFT",
                entityType: "Email",
                entityId: email.id,
                status: "PENDING",
                reason: `[Backfill] AI draft for ${leadName} in campaign ${campaignName} — created retroactively`,
                payload: {
                    emailId: email.id,
                    leadId: email.lead?.id,
                    campaignId: email.campaign?.id,
                    subject: email.subject,
                    body: email.body,
                },
            },
        });

        console.log(`    ✅ Created ApprovalRequest ${approval.id} for email ${email.id}`);
    }

    console.log("[backfill-orphaned-drafts] Done.");
}

main()
    .catch((err) => {
        console.error("[backfill-orphaned-drafts] Fatal error:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
