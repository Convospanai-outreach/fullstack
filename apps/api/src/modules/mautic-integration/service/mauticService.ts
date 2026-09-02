import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

// One shared Mautic instance (not per-team credentials) - see HANDOVER_CLAUDE_CODE.md
// §5/I6 decision: a single Mautic serves top-of-funnel capture/segmentation/funnel
// visualization for all teams, segmented by a per-team tag rather than a dedicated
// per-tenant stack. Mautic's own API is disabled by default (config/local.php must
// set api_enabled/api_enable_basic_auth - see docker/mautic/config/local.php) and
// authenticates here via HTTP Basic Auth, matching that config.
//
// This is a ONE-WAY push (app -> Mautic) only. Mautic never sends nurture/drip email
// for a lead already in this app's own sequence pipeline (see worker-manager.ts's
// sequence tick) - it exists purely so Mautic's segments/campaigns/funnel view reflect
// real captures, per the explicit send-ownership decision made before this module was
// built. Do not add a Mautic -> Lead sync path without revisiting that decision.

export interface MauticPushResult {
    status: "created" | "updated" | "skipped" | "error";
    mauticContactId?: string;
    details?: string;
}

function getMauticConfig() {
    const baseUrl = process.env["MAUTIC_BASE_URL"];
    const username = process.env["MAUTIC_USERNAME"];
    const password = process.env["MAUTIC_PASSWORD"];
    if (!baseUrl || !username || !password) return null;
    return { baseUrl: baseUrl.replace(/\/+$/, ""), username, password };
}

function authHeader(username: string, password: string) {
    return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

function teamSlug(teamId: string) {
    // Same value written as the segmentation tag/custom field on the Mautic side -
    // internal isolation still uses teamId, this is only the external-facing label.
    return `team-${teamId}`;
}

class MauticService {
    /**
     * Push one lead into Mautic as a contact, tagged with a team slug. Idempotent by
     * email: resubmitting the same email updates the existing Mautic contact instead
     * of creating a duplicate.
     */
    async pushLead(leadId: string, teamId: string): Promise<MauticPushResult> {
        const config = getMauticConfig();
        if (!config) {
            return { status: "skipped", details: "Mautic is not configured (MAUTIC_BASE_URL/USERNAME/PASSWORD missing)" };
        }

        try {
            // Scoped to teamId for the same reason crmService.syncLead is - leadId alone
            // isn't guaranteed to belong to the caller's team.
            const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId } });
            if (!lead) return { status: "error", details: "Lead not found" };
            if (!lead.email) return { status: "skipped", details: "Lead has no email" };

            const headers = {
                Authorization: authHeader(config.username, config.password),
                "Content-Type": "application/json",
            };

            const [firstName, ...rest] = (lead.fullName || "").split(" ").filter(Boolean);
            const body = {
                email: lead.email,
                firstname: firstName || undefined,
                lastname: rest.join(" ") || undefined,
                company: lead.company || undefined,
                tags: [teamSlug(teamId)],
            };

            const searchRes = await fetch(
                `${config.baseUrl}/api/contacts?search=${encodeURIComponent(`email:"${lead.email}"`)}&limit=1`,
                { headers }
            );
            if (!searchRes.ok) {
                throw new Error(`Mautic contact search failed: ${searchRes.status} ${await searchRes.text()}`);
            }
            const searchJson: any = await searchRes.json();
            const existingId = Object.keys(searchJson?.contacts || {})[0];

            let mauticContactId: string;
            let status: MauticPushResult["status"];

            if (existingId) {
                // PATCH for a partial update (only the fields in `body`), per Mautic's
                // documented contacts/{id}/edit contract - re-verify against the live
                // instance once Phase 3c's API enablement is done (Mautic's exact
                // supported verbs are version-dependent, same caveat as HANDOVER's F2).
                const editRes = await fetch(`${config.baseUrl}/api/contacts/${existingId}/edit`, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify(body),
                });
                if (!editRes.ok) {
                    throw new Error(`Mautic contact update failed: ${editRes.status} ${await editRes.text()}`);
                }
                mauticContactId = existingId;
                status = "updated";
            } else {
                const createRes = await fetch(`${config.baseUrl}/api/contacts/new`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(body),
                });
                if (!createRes.ok) {
                    throw new Error(`Mautic contact create failed: ${createRes.status} ${await createRes.text()}`);
                }
                const createJson: any = await createRes.json();
                mauticContactId = String(createJson?.contact?.id);
                status = "created";
            }

            await prisma.lead.update({
                where: { id: leadId },
                data: { mauticContactId, mauticSyncedAt: new Date() },
            });

            return { status, mauticContactId };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            logger.error(`[MauticService] pushLead error for lead ${leadId} (team ${teamId}):`, { error: errorMessage });
            return { status: "error", details: errorMessage };
        }
    }
}

export const mauticService = new MauticService();
