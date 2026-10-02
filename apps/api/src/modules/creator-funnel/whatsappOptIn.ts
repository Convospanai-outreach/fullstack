import { prisma } from "@/lib/db";

// Creator funnel (spec phase 5b): the lead-magnet and sales pages a launch plan drafts
// (LandingPage.funnelStage set) ask sign-ups whether the business may message them on WhatsApp.
// The box is unticked by default and names WhatsApp and the business. A tick is only kept with
// a phone number, and only becomes consent on the lead when the lead ends up with that same
// number (a merge can keep an older one). One ledger row per sign-up, so a retried intake job
// doesn't record it twice.

export const WHATSAPP_OPT_IN_VERSION = 1;

/** The checkbox text, built in one place for the public page payload, Cloudflare pages and the ledger. */
export function whatsappOptInText(businessName: string) {
    return `Yes, ${businessName} can message me on WhatsApp at the phone number above.`;
}

const phoneDigits = (phone: string | null | undefined) => phone?.replace(/\D/g, "") ?? "";

type SignUp = {
    id: string;
    teamId: string;
    phone: string | null;
    whatsappConsent: boolean | null;
    ipAddress: string | null;
    pageVersion: number | null;
    landingPage: { slug: string | null; team: { name: string } };
};

/** Records the sign-up's WhatsApp opt-in on the lead it became. True when a consent was recorded. */
export async function recordWhatsappOptIn(signUp: SignUp, leadId: string): Promise<boolean> {
    if (!signUp.whatsappConsent) return false;
    const submitted = phoneDigits(signUp.phone);
    if (submitted.length < 7) return false;
    const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId: signUp.teamId }, select: { phone: true } });
    if (!lead || phoneDigits(lead.phone) !== submitted) return false;

    const proof = `landing_lead:${signUp.id}`;
    const done = await prisma.consentLedger.findFirst({ where: { leadId, channel: "WHATSAPP", proof }, select: { id: true } });
    if (done) return false;

    const { ConsentService, ConsentMethod } = await import("@/modules/whatsapp/ConsentService");
    await ConsentService.recordConsent(
        leadId,
        null,
        ConsentMethod.WEB_FORM,
        `Ticked on landing page /p/${signUp.landingPage.slug} (page version ${signUp.pageVersion ?? "unknown"}, wording v${WHATSAPP_OPT_IN_VERSION}): "${whatsappOptInText(signUp.landingPage.team.name)}"`,
        "WHATSAPP",
        { proof, ipAddress: signUp.ipAddress },
    );
    return true;
}
