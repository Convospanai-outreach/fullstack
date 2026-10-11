import crypto from "crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { verifyLinkToken } from "./linkToken";
import { mergeSignupIntoSocialLead } from "./socialLinkMerge";

// Return path for Mautic-hosted forms: Mautic's "Form submitted" webhook lands here, so a sign-up
// on a Mautic page becomes (or joins) the CMf lead the Instagram/Facebook auto-reply went to.
// Mautic still sends nothing for the lead; only the sign-up flows back (see mauticService.ts).
//
// Checked 2026-10-11 against the Mautic source (mautic/mautic 7.x) and
// https://devdocs.mautic.org/en/5.x/webhooks/getting_started.html:
// - Every delivery has a Webhook-Signature header: base64 HMAC-SHA256 of the exact JSON body
//   with the webhook's secret (WebhookBundle Http/Client.php).
// - The body is { "<event type>": [ { ...payload, "timestamp": "..." }, ... ] }; the form event
//   type is "mautic.form_on_submit" and each payload has a "submission" (FormBundle
//   EventListener/WebhookSubscriber.php) with id, form, referer (the page URL) and results
//   (field alias -> value) (FormBundle Entity/Submission.php).
// - A non-2xx answer makes Mautic retry; HTTP 410 switches the webhook off.
// NOT verified on the live 7.2.1 instance yet: the exact shape of `results` for each field type.
//
// The team comes ONLY from the signed ?t= token (linkToken.ts), never from a form field: Mautic is
// shared by all teams, so a submission with no valid token is dropped.

export const MAUTIC_FORM_EVENT = "mautic.form_on_submit";

export function verifyMauticSignature(rawBody: Buffer, header: string | null, secret: string) {
    if (!header) return false;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const text = (value: unknown, max = 300) => (typeof value === "string" || typeof value === "number" ? String(value).trim().slice(0, max) : "") || undefined;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readSubmission(item: any) {
    const submission = item?.submission;
    if (!submission || typeof submission !== "object") return null;
    const results = submission.results && typeof submission.results === "object" ? submission.results : {};
    const referer = text(submission.referer, 2000);
    let page: URLSearchParams | null = null;
    try {
        page = referer ? new URL(referer).searchParams : null;
    } catch {
        page = null;
    }
    const email = text(results["email"], 320)?.toLowerCase();
    const fullName = [text(results["firstname"], 100), text(results["lastname"], 100)].filter(Boolean).join(" ");
    const submitted = new Date(submission.dateSubmitted);
    return {
        token: text(results["t"]) ?? page?.get("t") ?? undefined,
        email: email && EMAIL.test(email) ? email : undefined,
        name: text(results["name"], 200) ?? (fullName || undefined),
        phone: text(results["phone"], 50) ?? text(results["mobile"], 50),
        company: text(results["company"], 200),
        title: text(results["position"], 200) ?? text(results["title"], 200),
        utmContent: text(results["utm_content"], 200) ?? page?.get("utm_content")?.slice(0, 200),
        submittedAt: Number.isNaN(submitted.getTime()) || submitted.getTime() > Date.now() ? new Date() : submitted,
    };
}

type Outcome = "merged" | "joined" | "created" | "dropped";

async function ingestOne(item: any): Promise<Outcome> {
    const sub = readSubmission(item);
    if (!sub?.token) return "dropped";
    const replyId = verifyLinkToken(sub.token, sub.submittedAt);
    if (!replyId) return "dropped";
    const reply = await prisma.keywordTriggerReply.findFirst({ where: { id: replyId }, select: { teamId: true } });
    if (!reply) return "dropped";
    const { teamId } = reply;
    const { isCreatorFunnelEnabled } = await import("./featureGate");
    if (!(await isCreatorFunnelEnabled(teamId))) return "dropped";

    let leadId = await mergeSignupIntoSocialLead({
        teamId,
        socialToken: sub.token,
        createdAt: sub.submittedAt,
        email: sub.email ?? null,
        name: sub.name ?? null,
        phone: sub.phone ?? null,
        company: sub.company ?? null,
        title: sub.title ?? null,
    });
    let outcome: Outcome = "merged";
    if (!leadId) {
        // The auto-reply's lead can't take this sign-up safely (a different email, or the email is
        // another lead's): fall back to the team's lead with that email, or a new one.
        if (!sub.email) return "dropped";
        const existing = await prisma.lead.findFirst({ where: { teamId, email: { equals: sub.email, mode: "insensitive" } }, select: { id: true } });
        if (existing) {
            leadId = existing.id;
            outcome = "joined";
        } else {
            const created = await prisma.lead.create({
                data: { teamId, email: sub.email, fullName: sub.name, phone: sub.phone, company: sub.company, jobTitle: sub.title, source: "mautic_form", status: "NEW" },
                select: { id: true },
            });
            leadId = created.id;
            outcome = "created";
        }
    }
    const { afterSocialSignup } = await import("@/workers/handlers/landing-lead-intake-worker");
    await afterSocialSignup(teamId, leadId, sub.utmContent ?? null);
    return outcome;
}

/** Handles one verified delivery. `failed` > 0 means answer non-2xx so Mautic retries (every step is idempotent). */
export async function ingestMauticWebhook(body: unknown) {
    const events = (body as any)?.[MAUTIC_FORM_EVENT];
    const items: unknown[] = Array.isArray(events) ? events : [];
    const counts = { received: items.length, merged: 0, joined: 0, created: 0, dropped: 0, failed: 0 };
    for (const item of items) {
        try {
            counts[await ingestOne(item)] += 1;
        } catch (error) {
            counts.failed += 1;
            logger.error("[Mautic Webhook] Submission failed", { error: error instanceof Error ? error.message : String(error) });
        }
    }
    return counts;
}
