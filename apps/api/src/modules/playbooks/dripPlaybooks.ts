/**
 * Drip playbooks: ready-made email sequences tied to a trigger the platform can actually fire.
 * A playbook says when a lead joins (trigger), what each email is for (brief), what ends it
 * (exit reasons the sequence engine already applies) and the one number to watch (metric).
 * The email text is never stored here: it is written per team from their company profile and ICP.
 *
 * Triggers:
 *  - landing_signup: someone fills a form on one of the team's landing pages (lead magnet, ebook, brochure, webinar)
 *  - link_click: someone clicks a tracked link in an email the team sent (brochure, pricing, case study)
 *  - inactivity: a contact who has not opened, clicked or replied for a long time
 *  - manual: the owner adds the lead (proposal sent, call missed); no event exists for these yet
 */

export type DripKind =
    | "welcome"
    | "b2bNurture"
    | "linkClickFollowUp"
    | "proposalFollowUp"
    | "noShowRecovery"
    | "winBack"
    | "coldOutbound"
    | "postMeetingFollowUp"
    | "eventReminders"
    | "pricingIntent"
    | "referralRequest"
    | "warmReengage"
    | "trialOnboarding";
export type DripTriggerKind = "landing_signup" | "link_click" | "inactivity" | "manual";
/** What the email's single call to action leads to. "reply" and "none" never carry a link. */
export type DripCta = "asset" | "booking" | "reply" | "none";
/** Strings the sequence engine's exitReason() already returns, so these exits need no new code. */
export type DripExit = "replied" | "meeting_booked" | "unsubscribed" | "do_not_contact" | "bounced";

export type DripEmail = { delayDays: number; delayHours?: number; brief: string; cta: DripCta };

export type DripPlaybook = {
    kind: DripKind;
    name: string;
    goal: string;
    trigger: { kind: DripTriggerKind; label: string; automatic: boolean };
    exits: DripExit[];
    /** The one number to judge this playbook by. */
    metric: string;
    emails: DripEmail[];
};

const STOP: DripExit[] = ["replied", "meeting_booked", "unsubscribed", "do_not_contact", "bounced"];

export const DRIP_PLAYBOOKS: DripPlaybook[] = [
    {
        kind: "welcome",
        name: "Welcome series",
        goal: "Turn a new subscriber into a first conversation.",
        trigger: { kind: "landing_signup", label: "Someone signs up on a landing page", automatic: true },
        exits: STOP,
        metric: "Reply or booking rate",
        emails: [
            { delayDays: 0, brief: "Thank them for signing up and deliver what they asked for. Say in one line what to expect from you next.", cta: "asset" },
            { delayDays: 2, brief: "Say who you help and the one belief that shapes how you work. Make it specific to the offer, not a slogan.", cta: "reply" },
            { delayDays: 4, brief: "Show proof. Use only the results and proof points given above; if none are given, share one lesson you teach clients instead.", cta: "booking" },
            { delayDays: 7, brief: "A friendly, low-pressure invitation to the next step, and an easy way to say it isn't for them.", cta: "booking" },
        ],
    },
    {
        kind: "b2bNurture",
        name: "Resource download nurture",
        goal: "Educate a prospect who downloaded something and invite the right ones to a conversation.",
        trigger: { kind: "landing_signup", label: "Someone downloads an ebook, guide or brochure from a landing page", automatic: true },
        exits: STOP,
        metric: "Booking or reply rate",
        emails: [
            { delayDays: 0, brief: "Deliver the resource they requested with two or three takeaways worth reading it for.", cta: "asset" },
            { delayDays: 3, brief: "Teach one practical idea that solves a related problem for this audience.", cta: "reply" },
            { delayDays: 7, brief: "Show how a company like theirs gets a result. Use only the proof points given above; otherwise describe the typical approach with no numbers.", cta: "reply" },
            { delayDays: 12, brief: "Short, plain, personal: offer a quick call or review for their situation and ask them to reply to set it up.", cta: "booking" },
        ],
    },
    {
        kind: "linkClickFollowUp",
        name: "Brochure and link-click follow-up",
        goal: "Follow up quickly with someone who showed interest by clicking a brochure, pricing or case-study link.",
        trigger: { kind: "link_click", label: "Someone clicks a tracked link in your email", automatic: true },
        exits: STOP,
        metric: "Reply or booking rate",
        emails: [
            { delayDays: 0, delayHours: 2, brief: "They looked at what you sent. Ask one specific question about what they are trying to do, so a reply is easy. Do not say you tracked them.", cta: "reply" },
            { delayDays: 2, brief: "Answer the doubt people most often have at this point, in plain words.", cta: "reply" },
            { delayDays: 5, brief: "Offer a short call to see whether it fits, and make saying no easy.", cta: "booking" },
        ],
    },
    {
        kind: "proposalFollowUp",
        name: "Proposal follow-up",
        goal: "Get a decision, or a clear no, after a proposal or quote has been sent.",
        trigger: { kind: "manual", label: "You add a lead after sending a proposal", automatic: false },
        exits: STOP,
        metric: "Reply rate",
        emails: [
            { delayDays: 2, brief: "Check they received the proposal and ask whether any part needs explaining.", cta: "reply" },
            { delayDays: 5, brief: "Add one new useful thing, such as a short insight tied to their goal, and ask how they are leaning.", cta: "reply" },
            { delayDays: 10, brief: "Close the loop politely: say you will stop writing unless they want to continue, and invite a quick yes, no or not now.", cta: "reply" },
        ],
    },
    {
        kind: "noShowRecovery",
        name: "Missed-call recovery",
        goal: "Rebook someone who did not attend a scheduled call.",
        trigger: { kind: "manual", label: "You add a lead after a missed call", automatic: false },
        exits: STOP,
        metric: "Rebooking rate",
        emails: [
            { delayDays: 0, delayHours: 1, brief: "No blame. Say you missed them and offer a simple way to pick a new time.", cta: "booking" },
            { delayDays: 2, brief: "Offer a shorter option, or ask them to reply with a time that suits.", cta: "booking" },
            { delayDays: 5, brief: "A last, warm note that the door is open whenever the timing is right.", cta: "reply" },
        ],
    },
    {
        kind: "winBack",
        name: "Win-back",
        goal: "Re-engage contacts who have gone quiet, or let them go to protect your sender reputation.",
        trigger: { kind: "inactivity", label: "A contact has not opened, clicked or replied in 90 days", automatic: true },
        exits: STOP,
        metric: "Re-engagement rate (an open, click or reply)",
        emails: [
            { delayDays: 0, brief: "A friendly check-in. Mention what is most useful or new about the offer, without guilt.", cta: "reply" },
            { delayDays: 7, brief: "Ask what they would like to hear more about, or offer one genuinely useful thing, and make replying easy.", cta: "reply" },
            { delayDays: 14, brief: "Say plainly that you will stop emailing unless they want to stay, and invite one click or reply to stay on the list.", cta: "reply" },
        ],
    },
    {
        kind: "coldOutbound",
        name: "Cold outreach sequence",
        goal: "Start a conversation with a prospect who has not heard from you, in a few short, relevant touches.",
        trigger: { kind: "manual", label: "You add a lead you want to contact", automatic: false },
        exits: STOP,
        metric: "Reply rate",
        emails: [
            { delayDays: 0, brief: "Short and specific to their role: one observation about their situation, one line on how you help, and a single easy question. No attachments, no pitch deck.", cta: "reply" },
            { delayDays: 3, brief: "A different angle on the same problem, such as a common mistake or a quick idea they can use today. Do not repeat the first email.", cta: "reply" },
            { delayDays: 7, brief: "Show how you helped someone like them. Use only the proof points given above; otherwise describe the typical approach with no numbers.", cta: "reply" },
            { delayDays: 12, brief: "Offer a short call to see whether it is worth their time, and make it easy to say no or point you to the right person.", cta: "booking" },
            { delayDays: 19, brief: "A brief break-up note: say you will stop writing, leave the door open, and invite a one-word reply if the timing is wrong.", cta: "reply" },
        ],
    },
    {
        kind: "postMeetingFollowUp",
        name: "Post-meeting follow-up",
        goal: "Keep momentum after a good call by confirming next steps and nudging the decision forward.",
        trigger: { kind: "manual", label: "You add a lead after a meeting", automatic: false },
        exits: STOP,
        metric: "Next-step rate (a reply or a booked follow-up)",
        emails: [
            { delayDays: 0, delayHours: 3, brief: "Thank them for their time, recap in two or three lines what you agreed, and state the next step and who owns it.", cta: "reply" },
            { delayDays: 3, brief: "Send one useful thing tied to what they said on the call, such as a short note or example, and ask if they have questions.", cta: "reply" },
            { delayDays: 7, brief: "Check in on the next step. Offer a quick call to unblock anything, and make it fine to say the timing has changed.", cta: "booking" },
        ],
    },
    {
        kind: "eventReminders",
        name: "Event and webinar reminders",
        goal: "Get more registrants to show up, then follow up with the people who attended or missed it.",
        trigger: { kind: "manual", label: "You add a lead when they register for your event", automatic: false },
        exits: STOP,
        metric: "Attendance or follow-up reply rate",
        emails: [
            { delayDays: 0, brief: "Confirm their registration, say what they will get from the event, and tell them what to bring or prepare. Use only the event details given by the owner; do not invent a date or time.", cta: "none" },
            { delayDays: 2, brief: "A short reminder that the event is coming up, with the single reason it is worth their time.", cta: "asset" },
            { delayDays: 5, brief: "Thank them for registering. Share the recording or key takeaways if they exist, and invite a conversation about how it applies to them.", cta: "reply" },
        ],
    },
    {
        kind: "pricingIntent",
        name: "Pricing and case-study interest",
        goal: "Reach someone quickly after they open your pricing or a case study, while they are still weighing options.",
        trigger: { kind: "link_click", label: "Someone clicks your pricing or case-study link", automatic: true },
        exits: STOP,
        metric: "Booking rate",
        emails: [
            { delayDays: 0, delayHours: 1, brief: "Say you are happy to answer questions about the plans or the example they looked at, and ask what they are trying to achieve. Do not say you tracked them.", cta: "reply" },
            { delayDays: 2, brief: "Address the worry buyers most often have about price or fit, honestly and without pressure.", cta: "reply" },
            { delayDays: 4, brief: "Offer a short call to find the right option for their situation, and make it easy to say not now.", cta: "booking" },
        ],
    },
    {
        kind: "referralRequest",
        name: "Review and referral request",
        goal: "Ask a happy customer for a review or an introduction while the result is fresh.",
        trigger: { kind: "manual", label: "You add a customer after a successful deal or delivery", automatic: false },
        exits: STOP,
        metric: "Reviews or referrals received",
        emails: [
            { delayDays: 7, brief: "Thank them for choosing you and ask how things are going. No ask yet; make a reply easy.", cta: "reply" },
            { delayDays: 14, brief: "Ask for a short review or testimonial in their own words. Make it a one-minute task and thank them either way.", cta: "reply" },
            { delayDays: 21, brief: "Ask whether they know one person who has the same problem, and offer to write the introduction for them to forward.", cta: "reply" },
        ],
    },
    {
        kind: "warmReengage",
        name: "Warm lead re-engagement",
        goal: "Pick a conversation back up with a lead who showed interest and then went quiet.",
        trigger: { kind: "manual", label: "You add a lead who was interested and went quiet", automatic: false },
        exits: STOP,
        metric: "Reply rate",
        emails: [
            { delayDays: 0, brief: "Refer to where you left off, without guilt, and ask one simple question to restart the conversation.", cta: "reply" },
            { delayDays: 4, brief: "Share one thing that has changed or one useful idea since you last spoke, and ask if it is still a priority.", cta: "reply" },
            { delayDays: 9, brief: "Say you will assume the timing is not right and stop writing, and invite a reply if that changes.", cta: "reply" },
        ],
    },
    {
        kind: "trialOnboarding",
        name: "Trial and onboarding nudges",
        goal: "Help a new trial or sign-up user reach their first success, and offer help if they stall.",
        trigger: { kind: "manual", label: "You add a lead when they start a trial or sign up", automatic: false },
        exits: STOP,
        metric: "Activation rate (first key action done)",
        emails: [
            { delayDays: 0, brief: "Welcome them, name the one first step that gets value fastest, and say where to find help.", cta: "asset" },
            { delayDays: 2, brief: "Ask whether they got that first step done and share the next most useful step. Keep it to one action.", cta: "reply" },
            { delayDays: 5, brief: "Share a short example of how someone like them uses it well, and offer a quick walkthrough call.", cta: "booking" },
            { delayDays: 9, brief: "Ask what is getting in the way, offer help, and make it easy to say they are not using it right now.", cta: "reply" },
        ],
    },
];

export const getDripPlaybook = (kind: string) => DRIP_PLAYBOOKS.find((p) => p.kind === kind);

// ---------------------------------------------------------------------------------------------
// Fit: which playbooks suit a team, judged from its website scan and ICP. Plain rules, no model call.
// ---------------------------------------------------------------------------------------------

export type FitProfile = {
    industry_vertical?: string;
    products_or_services?: string[];
    pricing_model?: string;
    value_proposition?: string;
    cta_language?: string[];
    proof_points?: string[];
    target_customer_profile?: { buyer_role?: string[] };
    icp_primary?: { buyer_title?: string; industry?: string };
};
export type FitIcp = { buyerTitles?: string[]; industries?: string[]; geographies?: string[] } | null;

export type DripRecommendation = { kind: DripKind; score: number; reasons: string[] };

const has = (haystack: string, ...words: string[]) => words.some((w) => haystack.includes(w));

/** Playbooks ranked by fit, best first. Always returns every playbook, so the owner can still pick any. */
export function recommendDripPlaybooks(profile: FitProfile | null | undefined, icp: FitIcp = null): DripRecommendation[] {
    const p = profile ?? {};
    const text = [p.industry_vertical, p.pricing_model, p.value_proposition, ...(p.products_or_services ?? [])].join(" ").toLowerCase();
    const cta = (p.cta_language ?? []).join(" ").toLowerCase();
    const buyers = [p.icp_primary?.buyer_title, ...(p.target_customer_profile?.buyer_role ?? []), ...(icp?.buyerTitles ?? [])].filter(Boolean);
    const isB2B = buyers.length > 0 || has(text, "b2b", "consult", "agency", "software", "saas", "advis", "service", "enterprise");
    const sellsCalls = has(cta, "book", "call", "demo", "consult", "schedule", "talk", "audit") || has(text, "consult", "coach", "advis", "agency", "clinic", "legal", "account");
    const quoteBased = has(text, "quote", "proposal", "custom", "retainer", "project", "contact us", "bespoke");
    const hasResource = has(cta, "download", "guide", "ebook", "e-book", "whitepaper", "checklist", "brochure", "webinar", "template");

    const score = new Map<DripKind, DripRecommendation>(
        DRIP_PLAYBOOKS.map((d) => [d.kind, { kind: d.kind, score: 0, reasons: [] }]),
    );
    const add = (kind: DripKind, points: number, reason: string) => {
        const r = score.get(kind)!;
        r.score += points;
        r.reasons.push(reason);
    };

    add("welcome", 50, "Every business gains from a first-impression series");
    add("winBack", 40, "Protects your sender reputation and revives quiet contacts");
    if (isB2B) add("b2bNurture", 45, "You sell to businesses, where buyers research before they talk");
    if (hasResource) {
        add("b2bNurture", 20, "Your site offers a downloadable resource");
        add("linkClickFollowUp", 15, "You can follow up when someone opens that resource");
    }
    if (isB2B) add("linkClickFollowUp", 25, "Interest signals matter most when deals take several touches");
    if (sellsCalls) add("noShowRecovery", 40, "You sell through booked calls, where no-shows cost real money");
    if (quoteBased) add("proposalFollowUp", 55,"You send quotes or proposals that need a follow-up");
    else if (sellsCalls) add("proposalFollowUp", 25, "Calls usually end with a proposal to chase");
    if (p.proof_points?.length) add("welcome", 5, "Your site has proof points the series can use");

    const hasEvent = has(cta, "webinar", "event", "workshop", "register", "masterclass");
    const hasTrial = has(cta, "trial", "sign up", "signup", "get started", "free plan") || has(text, "saas", "software", "platform");
    add("coldOutbound", isB2B ? 35 : 15, isB2B ? "You sell to businesses, where outbound reaches buyers who are not yet looking" : "Outbound can reach people who do not know you yet");
    if (sellsCalls) add("postMeetingFollowUp", 45, "You sell through calls, where a prompt recap keeps the deal moving");
    else add("postMeetingFollowUp", 15, "Any meeting is worth a short recap and next step");
    if (hasEvent) add("eventReminders", 45, "Your site promotes a webinar or event");
    if (isB2B) add("pricingIntent", 20, "Pricing and case-study views are strong buying signals");
    if (has(text, "pricing", "subscription", "per month", "tier") || quoteBased) add("pricingIntent", 15, "You have pricing buyers will want to compare");
    add("referralRequest", p.proof_points?.length ? 30 : 20, "Happy customers are your cheapest source of new leads");
    add("warmReengage", 30, "Interested leads who go quiet are cheaper to win back than new ones");
    if (hasTrial) add("trialOnboarding", 45, "You offer a trial or sign-up where early help lifts activation");

    return [...score.values()].sort((a, b) => b.score - a.score);
}
