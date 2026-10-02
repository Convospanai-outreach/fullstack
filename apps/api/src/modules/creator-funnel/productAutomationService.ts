import { z } from "zod";
import { prisma } from "@/lib/db";
import { ContentPostError } from "./contentPostService";
import { isHttpsUrl } from "./checkoutHooks";
import { nurtureCanRunSteps } from "./nurtureProvider";

// Per-product creator funnel automations (checkoutHooks.ts): the delivery email after payment and
// the cart-abandon sequence. Saved switched off; switching on checks the setup and records who and
// when, which is the approval for those automatic sends.

export const updateAutomationSchema = z.object({
    deliveryUrl: z.string().trim().max(2000).nullable().optional(),
    deliveryMailboxId: z.string().max(64).nullable().optional(),
    cartAbandonSequenceId: z.string().max(64).nullable().optional(),
    cartAbandonHours: z.number().int().min(1).max(168).nullable().optional(),
    postPurchaseSequenceId: z.string().max(64).nullable().optional(),
    active: z.boolean().optional(),
});
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;

type Config = {
    deliveryUrl: string | null;
    deliveryMailboxId: string | null;
    cartAbandonSequenceId: string | null;
    cartAbandonHours: number | null;
    postPurchaseSequenceId: string | null;
};

const fail = (message: string, status = 400): never => {
    throw new ContentPostError(status, message);
};

async function findProduct(teamId: string, productId: string) {
    const product = await prisma.product.findFirst({ where: { id: productId, teamId } });
    if (!product) fail("Product not found", 404);
    return product!;
}

async function checkConfig(teamId: string, config: Config, activating: boolean) {
    const delivery = Boolean(config.deliveryUrl);
    const abandon = Boolean(config.cartAbandonSequenceId);
    if (config.deliveryUrl && !isHttpsUrl(config.deliveryUrl)) fail("The delivery link must be an https:// link.");
    if (delivery && !config.deliveryMailboxId) fail("Pick the mailbox the delivery email goes from.");
    if (config.deliveryMailboxId) {
        const mailbox = await prisma.connectedMailbox.findFirst({
            where: { id: config.deliveryMailboxId, teamId, status: "CONNECTED" },
            select: { id: true },
        });
        if (!mailbox) fail("That mailbox isn't connected.");
    }
    if (abandon !== (config.cartAbandonHours != null)) fail("Set both the cart-abandon sequence and the hours to wait.");
    for (const sequenceId of [config.cartAbandonSequenceId, config.postPurchaseSequenceId]) {
        if (!sequenceId) continue;
        const sequence = await prisma.campaignSequence.findFirst({
            where: { id: sequenceId, teamId },
            select: { steps: { where: { status: "ACTIVE" }, select: { stepType: true } } },
        });
        if (!sequence) fail("That sequence wasn't found.");
        if (!nurtureCanRunSteps(sequence!.steps.map((step) => step.stepType))) {
            fail("That sequence has no steps, or has steps a nurture can't run yet (email, delay, condition and manual review only).");
        }
    }
    if (activating && !delivery && !abandon && !config.postPurchaseSequenceId) {
        fail("Add a delivery link, a cart-abandon sequence or an after-purchase sequence before switching on.");
    }
}

function view(product: Awaited<ReturnType<typeof findProduct>>) {
    return {
        productId: product.id,
        deliveryUrl: product.deliveryUrl,
        deliveryMailboxId: product.deliveryMailboxId,
        cartAbandonSequenceId: product.cartAbandonSequenceId,
        cartAbandonHours: product.cartAbandonHours,
        postPurchaseSequenceId: product.postPurchaseSequenceId,
        active: product.automationsActive,
        activatedAt: product.automationsActivatedAt,
    };
}

export async function getAutomation(teamId: string, productId: string) {
    const product = await findProduct(teamId, productId);
    const [mailboxes, sequences, deliveries] = await Promise.all([
        prisma.connectedMailbox.findMany({ where: { teamId, status: "CONNECTED" }, select: { id: true, email: true }, orderBy: { email: "asc" } }),
        prisma.campaignSequence.findMany({
            where: { teamId },
            select: { id: true, name: true, steps: { where: { status: "ACTIVE" }, select: { stepType: true } } },
            orderBy: { updatedAt: "desc" },
            take: 100,
        }),
        prisma.order.findMany({
            where: { teamId, productId, deliveryStatus: { not: null } },
            select: { id: true, deliveryStatus: true, deliveryError: true, deliveredAt: true, updatedAt: true },
            orderBy: { updatedAt: "desc" },
            take: 5,
        }),
    ]);
    return {
        automation: view(product),
        mailboxes,
        sequences: sequences.map((sequence) => ({ id: sequence.id, name: sequence.name, usable: nurtureCanRunSteps(sequence.steps.map((step) => step.stepType)) })),
        recentDeliveries: deliveries,
    };
}

export async function updateAutomation(teamId: string, userId: string, productId: string, input: UpdateAutomationInput) {
    const product = await findProduct(teamId, productId);
    const config: Config = {
        deliveryUrl: input.deliveryUrl !== undefined ? input.deliveryUrl || null : product.deliveryUrl,
        deliveryMailboxId: input.deliveryMailboxId !== undefined ? input.deliveryMailboxId : product.deliveryMailboxId,
        cartAbandonSequenceId: input.cartAbandonSequenceId !== undefined ? input.cartAbandonSequenceId : product.cartAbandonSequenceId,
        cartAbandonHours: input.cartAbandonHours !== undefined ? input.cartAbandonHours : product.cartAbandonHours,
        postPurchaseSequenceId: input.postPurchaseSequenceId !== undefined ? input.postPurchaseSequenceId : product.postPurchaseSequenceId,
    };
    const active = input.active ?? product.automationsActive;
    const switchingOn = active && !product.automationsActive;
    // Switching off always works; anything that leaves it on (or turns it on) must be a working setup.
    const onlySwitchingOff = input.active === false && Object.keys(input).length === 1;
    if (!onlySwitchingOff) await checkConfig(teamId, config, active);

    const updated = await prisma.product.updateMany({
        where: { id: productId, teamId },
        data: {
            ...(onlySwitchingOff ? {} : config),
            automationsActive: active,
            ...(switchingOn ? { automationsActivatedById: userId, automationsActivatedAt: new Date() } : {}),
        },
    });
    if (updated.count === 0) fail("Product not found", 404);
    return view(await findProduct(teamId, productId));
}
