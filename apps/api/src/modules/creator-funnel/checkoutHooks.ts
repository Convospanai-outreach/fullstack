import crypto from "node:crypto";
import { prisma } from "@/lib/db";

// Creator funnel checkout hooks (teams with the flag on):
// - checkout started -> the buyer's existing lead moves to BOFU;
// - not paid within the product's hours -> that lead joins the product's cart-abandon sequence;
// - payment captured -> the lead (created now if there wasn't one) moves to POST, its nurture
//   stops, and the delivery link is emailed from the product's mailbox.
// The checkout endpoint is public and its email unverified, so checkout start only ever acts on a
// lead the team already has; a new lead is only made from a verified payment. Delivery and
// cart-abandon only run on products whose automations someone switched on (that's the approval),
// and only for orders started after that.

export const CART_ABANDON_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // older carts are never emailed
const CART_ABANDON_BATCH = 25;

type Order = { id: string; teamId: string; customerEmail: string | null; customerName: string | null; leadId: string | null };

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).slice(0, 500);

async function flagOn(teamId: string) {
    const { isCreatorFunnelEnabled } = await import("./featureGate");
    return isCreatorFunnelEnabled(teamId);
}

function normalEmail(email: string | null | undefined) {
    return email?.trim().toLowerCase() || null;
}

async function findLeadByEmail(teamId: string, email: string) {
    return prisma.lead.findFirst({
        where: { teamId, email: { equals: email, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
        select: { id: true },
    });
}

async function linkLead(order: Order, leadId: string) {
    await prisma.order.updateMany({ where: { id: order.id, teamId: order.teamId, leadId: null }, data: { leadId } });
}

/** Called by checkoutService once the gateway session exists (an order nobody could pay is never touched). */
export async function onCheckoutStarted(orderId: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, teamId: true, customerEmail: true, customerName: true, leadId: true },
    });
    if (!order || !(await flagOn(order.teamId))) return;
    const email = normalEmail(order.customerEmail);
    if (!email) return;
    const lead = await findLeadByEmail(order.teamId, email);
    if (!lead) return;
    await linkLead(order, lead.id);
    const { applyFunnelEvent } = await import("./funnelStageService");
    await applyFunnelEvent(order.teamId, lead.id, "checkout_started");
}

/** Called by the order_captured job (payment verified by the Stripe/Razorpay webhook). Never throws. */
export async function onOrderCaptured(teamId: string, orderId: string) {
    try {
        if (!(await flagOn(teamId))) return;
        const order = await prisma.order.findFirst({
            where: { id: orderId, teamId, status: "CAPTURED" },
            include: { product: true },
        });
        if (!order) return;

        const leadId = order.leadId ?? (await leadForBuyer(order));
        if (leadId) {
            const { applyFunnelEvent } = await import("./funnelStageService");
            await applyFunnelEvent(teamId, leadId, "payment_succeeded").catch((error) =>
                console.warn(`[CheckoutHooks] Stage update failed for lead ${leadId}: ${errorText(error)}`),
            );
            const { stopNurture } = await import("./nurtureProvider");
            await stopNurture(teamId, leadId, "purchased").catch((error) =>
                console.warn(`[CheckoutHooks] Stopping nurture failed for lead ${leadId}: ${errorText(error)}`),
            );
        }
        await sendDelivery(order, leadId);
    } catch (error) {
        console.error(`[CheckoutHooks] Order ${orderId} hooks failed: ${errorText(error)}`);
    }
}

// The buyer's lead: an existing one with that email, or a new one (a verified payment is a real buyer).
async function leadForBuyer(order: Order) {
    const email = normalEmail(order.customerEmail);
    if (!email) return null;
    const existing = await findLeadByEmail(order.teamId, email);
    const leadId =
        existing?.id ??
        (
            await prisma.lead.create({
                data: { teamId: order.teamId, email, fullName: order.customerName?.trim() || undefined, source: "checkout", status: "NEW" },
                select: { id: true },
            })
        ).id;
    await linkLead(order, leadId);
    return leadId;
}

type Product = {
    name: string;
    deliveryUrl: string | null;
    deliveryMailboxId: string | null;
    automationsActive: boolean;
    automationsActivatedAt: Date | null;
};

const escapeHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function isHttpsUrl(value: string) {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}

export function deliveryEmail(productName: string, url: string, customerName: string | null) {
    const name = customerName?.trim();
    return {
        subject: `Your ${productName}`,
        html: [
            `<p>Hi${name ? ` ${escapeHtml(name)}` : ""},</p>`,
            `<p>Thanks for buying ${escapeHtml(productName)}. Here's your access link:</p>`,
            `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>`,
        ].join("\n"),
    };
}

// One delivery email per order. The row goes to SENDING right before the single send and is never
// retried from there (the outbox may replay the job), so a buyer can't get it twice.
async function sendDelivery(order: Order & { createdAt: Date; product: Product }, leadId: string | null) {
    const { product } = order;
    const configured = product.automationsActive && product.deliveryUrl && product.deliveryMailboxId;
    if (!configured || !product.automationsActivatedAt || order.createdAt < product.automationsActivatedAt) return;

    const finish = (data: { deliveryStatus: string; deliveryError?: string; deliveredAt?: Date }) =>
        prisma.order.updateMany({ where: { id: order.id, teamId: order.teamId, deliveryStatus: "SENDING" }, data });
    const claimed = await prisma.order.updateMany({
        where: { id: order.id, teamId: order.teamId, deliveryStatus: null },
        data: { deliveryStatus: "SENDING" },
    });
    if (claimed.count !== 1) return;

    const to = normalEmail(order.customerEmail);
    const url = product.deliveryUrl!;
    if (!to) return finish({ deliveryStatus: "SKIPPED", deliveryError: "The order has no buyer email." });
    if (!isHttpsUrl(url)) return finish({ deliveryStatus: "FAILED", deliveryError: "The delivery link isn't an https link." });

    const { isSuppressed } = await import("@/modules/email-campaigner/service/googleMailboxService");
    if (await isSuppressed(order.teamId, to)) return finish({ deliveryStatus: "SKIPPED", deliveryError: "The buyer is on the suppression list." });
    const mailbox = await prisma.connectedMailbox.findFirst({
        where: { id: product.deliveryMailboxId!, teamId: order.teamId, status: "CONNECTED" },
        select: { id: true, provider: true },
    });
    if (!mailbox) return finish({ deliveryStatus: "FAILED", deliveryError: "The delivery mailbox isn't connected." });

    const { subject, html } = deliveryEmail(product.name, url, order.customerName);
    let outcome: { success: true } | { success: false; error: string };
    try {
        outcome = await sendFromMailbox(order.teamId, order.id, mailbox, to, subject, html);
    } catch (error) {
        outcome = { success: false, error: errorText(error) };
    }
    if (!outcome.success) return finish({ deliveryStatus: "FAILED", deliveryError: outcome.error.slice(0, 500) });

    await finish({ deliveryStatus: "SENT", deliveredAt: new Date() });
    if (leadId) {
        await prisma.message
            .create({
                data: { leadId, content: `Delivery email: ${subject}\n${url}`, direction: "OUTBOUND", platform: "EMAIL", sender: "Delivery", status: "sent", isRead: true },
            })
            .catch(() => undefined);
    }
}

// Same provider dispatch as the inbox reply (actionInboxService.sendReply).
async function sendFromMailbox(teamId: string, orderId: string, mailbox: { id: string; provider: string }, to: string, subject: string, html: string) {
    if (mailbox.provider === "RESEND") {
        const { sendViaResendMailbox } = await import("@/modules/email-campaigner/service/resendMailboxService");
        // Resend dedupes on this key for 24h, a second guard on top of the SENDING claim.
        return sendViaResendMailbox({ teamId, mailboxId: mailbox.id, to, subject, html, trackingId: crypto.randomUUID(), idempotencyKey: `order_delivery_${orderId}` });
    }
    if (mailbox.provider === "SMTP") {
        const { sendViaSmtpMailbox } = await import("@/modules/email-campaigner/service/smtpConfigService");
        return sendViaSmtpMailbox({ teamId, mailboxId: mailbox.id, to, subject, html });
    }
    const { sendViaGmailMailbox } = await import("@/modules/email-campaigner/service/googleMailboxService");
    return sendViaGmailMailbox({ teamId, mailboxId: mailbox.id, to, subject, html });
}

/**
 * Worker tick: unpaid checkouts past their product's cart-abandon hours. Each order is handed off at
 * most once (abandonHandledAt is claimed first). The lead's current nurture stops, then it joins the
 * product's cart-abandon sequence, unless it has paid for the product since.
 */
export async function processAbandonedCarts(now = new Date()) {
    const candidates = await prisma.order.findMany({
        where: {
            status: "PENDING",
            abandonHandledAt: null,
            leadId: { not: null },
            gatewaySessionId: { not: null },
            createdAt: { gte: new Date(now.getTime() - CART_ABANDON_MAX_AGE_MS) },
            product: { automationsActive: true, cartAbandonSequenceId: { not: null }, cartAbandonHours: { not: null } },
        },
        include: { product: { select: { cartAbandonSequenceId: true, cartAbandonHours: true, automationsActivatedAt: true } } },
        orderBy: { createdAt: "asc" },
        take: 200,
    });
    const due = candidates
        .filter((order) => {
            const { cartAbandonHours, automationsActivatedAt } = order.product;
            return (
                automationsActivatedAt !== null &&
                order.createdAt >= automationsActivatedAt &&
                order.createdAt.getTime() + cartAbandonHours! * 60 * 60 * 1000 <= now.getTime()
            );
        })
        .slice(0, CART_ABANDON_BATCH);

    let enrolled = 0;
    for (const order of due) {
        const claimed = await prisma.order.updateMany({
            where: { id: order.id, status: "PENDING", abandonHandledAt: null },
            data: { abandonHandledAt: now },
        });
        if (claimed.count !== 1) continue;
        try {
            if (!(await flagOn(order.teamId))) continue;
            const leadId = order.leadId!;
            const paid = await prisma.order.findFirst({
                where: { teamId: order.teamId, productId: order.productId, leadId, status: "CAPTURED" },
                select: { id: true },
            });
            if (paid) continue;
            const { stopNurture, enrollInNurture } = await import("./nurtureProvider");
            await stopNurture(order.teamId, leadId, "cart_abandoned");
            await enrollInNurture(order.teamId, leadId, order.product.cartAbandonSequenceId!);
            enrolled++;
        } catch (error) {
            console.warn(`[CheckoutHooks] Cart-abandon hand-off failed for order ${order.id}: ${errorText(error)}`);
        }
    }
    return { enrolled };
}
