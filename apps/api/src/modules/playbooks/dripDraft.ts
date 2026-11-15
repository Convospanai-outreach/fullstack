import { z } from "zod";
import { prisma } from "@/lib/db";
import { readIcpCriteria } from "@/modules/icp-builder/service/icpCriteria";
import { emailHtml } from "@/modules/creator-funnel/playbookSequences";
import { getDripPlaybook, type DripEmail, type DripPlaybook, type FitIcp, type FitProfile } from "./dripPlaybooks";

/**
 * Saves a drip playbook as a draft campaign with a DRAFT sequence for the team to review. Nothing is
 * enrolled and nothing is sent: the owner switches it on later. Each email is written from the team's
 * own company profile and ICP; links come only from URLs the team supplied, never from the model.
 */

export class DripInputError extends Error {}

export type DripLinks = { assetUrl?: string | null; assetLabel?: string | null; bookingUrl?: string | null };
/** Takes the prompt, returns the model's reply as JSON text. */
export type DripWriter = (prompt: string) => Promise<string>;

type Profile = FitProfile & {
    company_name?: string;
    tone_of_voice?: string;
    campaign_seed?: { subject_line_variants?: string[] };
    icp_primary?: { buyer_title?: string; industry?: string; company_size?: string; trigger_event?: string; pain_statement?: string };
};
type TeamIcp = (NonNullable<FitIcp> & { id: string }) | null;

const clip = (v: unknown, max: number) => (typeof v === "string" ? [...v.trim()].slice(0, max).join("") : "");
const emailSchema = z.object({ subject: z.string().min(1), body: z.string().min(1) });

function safeHttpUrl(value: unknown): string | null {
    if (typeof value !== "string" || !value.trim()) return null;
    try {
        const url = new URL(value.trim());
        return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
        return null;
    }
}

/** The team's saved company profile (website scan), primary ICP and calendar link. */
export async function loadDripContext(teamId: string, icpId?: string | null) {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { aiConfig: true } });
    const ai = (team?.aiConfig ?? {}) as { companyProfile?: Profile; calendarLink?: string };
    const icpRow = icpId
        ? await prisma.iCP.findFirst({ where: { id: icpId, teamId }, select: { id: true, criteria: true } })
        : await prisma.iCP.findFirst({ where: { teamId, status: "active" }, orderBy: { createdAt: "desc" }, select: { id: true, criteria: true } });
    const facts = readIcpCriteria(icpRow?.criteria);
    const icp: TeamIcp = icpRow ? { id: icpRow.id, buyerTitles: facts.roles, industries: facts.industries, geographies: facts.geographies } : null;
    return { profile: ai.companyProfile ?? null, icp, calendarLink: safeHttpUrl(ai.calendarLink) };
}

function contextLines(profile: Profile | null, icp: TeamIcp): string[] {
    if (!profile) return ["Company details were not provided. Keep the email general and honest, and don't claim anything about the business."];
    const p = profile.icp_primary ?? {};
    const lines = [
        profile.company_name && `Company: ${clip(profile.company_name, 100)}`,
        profile.value_proposition && `What they offer: ${clip(profile.value_proposition, 400)}`,
        (p.buyer_title || p.industry || icp?.buyerTitles?.length) &&
            `Who it is for: ${clip(p.buyer_title || icp?.buyerTitles?.[0], 80)} ${p.industry ? `in ${clip(p.industry, 80)}` : ""} ${p.company_size ? `(${clip(p.company_size, 30)})` : ""}`.replace(/\s+/g, " ").trim(),
        icp?.geographies?.length && `Target markets: ${icp.geographies.map((g) => clip(g, 60)).join(", ")}. Use the spelling and level of formality normal for business email there, and never mention a country, nationality, religion or culture, or stereotype anyone.`,
        p.pain_statement && `Their problem before they buy: ${clip(p.pain_statement, 300)}`,
        p.trigger_event && `What usually makes them look: ${clip(p.trigger_event, 200)}`,
        profile.tone_of_voice && `Tone: ${clip(profile.tone_of_voice, 60)}`,
        profile.proof_points?.length ? `Proof points you may use, and nothing else: ${profile.proof_points.slice(0, 5).map((x) => clip(x, 200)).join("; ")}` : "No proof points were given, so don't state any results.",
        profile.campaign_seed?.subject_line_variants?.length && `Subject line ideas for tone: ${profile.campaign_seed.subject_line_variants.slice(0, 3).map((x) => clip(x, 100)).join(" | ")}`,
    ];
    return lines.filter((l): l is string => Boolean(l));
}

/** The one link an email ends with, from team-supplied URLs only; null when the email asks for a reply instead. */
function linkFor(email: DripEmail, links: DripLinks) {
    if (email.cta === "asset") {
        const href = safeHttpUrl(links.assetUrl);
        return href ? { href, label: clip(links.assetLabel, 60) || "Open the resource" } : null;
    }
    if (email.cta === "booking") {
        const href = safeHttpUrl(links.bookingUrl);
        return href ? { href, label: "Book a time" } : null;
    }
    return null;
}

export function buildDripEmailPrompt(context: string[], playbook: DripPlaybook, email: DripEmail, index: number, hasLink: boolean) {
    const ending = hasLink
        ? "End with one sentence leading to a link; the link is added below your text, so don't write it."
        : email.cta === "none"
          ? "No call to action; be useful."
          : "End by asking one easy question they can answer by replying.";
    return [
        `You write one email in a "${playbook.name}" email sequence. Purpose of the sequence: ${playbook.goal}`,
        ...context,
        "",
        `This is email ${index + 1} of ${playbook.emails.length}. Goal of this email: ${email.brief}`,
        "Plain text, at most 150 words, short paragraphs separated by a blank line. Write like one person to one person, not a brand. One idea and one call to action only.",
        ending,
        "Don't include links or URLs, placeholders like [Name], prices, discounts, numbers, customer names or testimonials that aren't given above.",
        'Return JSON only: {"subject":"...","body":"..."}',
    ].join("\n");
}

async function defaultWriter(teamId: string): Promise<DripWriter> {
    const [{ aiService, extractJsonBlock }, { TaskComplexity }] = await Promise.all([import("@/lib/aiService"), import("@/ai/types")]);
    return async (prompt) => {
        // The prompt is built by the server around the team's own saved profile, so it skips the
        // user-typing phrase rules and keeps a size cap. Billed like other drafts.
        const raw = await aiService.askAI(prompt, teamId, {
            taskType: "DRIP_PLAYBOOK",
            surface: "GENERIC",
            complexity: TaskComplexity.ROUTINE,
            expectsJson: true,
            maxPromptChars: 12_000,
        });
        return extractJsonBlock(String(raw));
    };
}

export async function createDripDraft(
    input: { teamId: string; userId: string | null; kind: string; icpId?: string | null; links?: DripLinks; timezone?: string },
    write?: DripWriter,
): Promise<{ campaignId: string; sequenceId: string; emails: number }> {
    const playbook = getDripPlaybook(input.kind);
    if (!playbook) throw new DripInputError("Unknown playbook");
    const timezone = clip(input.timezone, 60) || "UTC";

    const ctx = await loadDripContext(input.teamId, input.icpId);
    const links: DripLinks = {
        assetUrl: safeHttpUrl(input.links?.assetUrl),
        assetLabel: input.links?.assetLabel,
        bookingUrl: safeHttpUrl(input.links?.bookingUrl) ?? ctx.calendarLink,
    };
    const lines = contextLines(ctx.profile, ctx.icp);
    const writer = write ?? (await defaultWriter(input.teamId));

    // All emails are written before anything is saved, so a failed model call leaves nothing behind.
    const written = await Promise.all(
        playbook.emails.map(async (email, i) => {
            const link = linkFor(email, links);
            const raw = await writer(buildDripEmailPrompt(lines, playbook, email, i, Boolean(link)));
            const parsed = emailSchema.parse(JSON.parse(raw));
            return { subject: clip(parsed.subject, 200), body: emailHtml(clip(parsed.body, 4000), link) };
        }),
    );

    const name = clip(`${playbook.name}${ctx.profile?.company_name ? `: ${ctx.profile.company_name}` : ""}`, 120);
    return prisma.$transaction(async (tx) => {
        const campaign = await tx.campaign.create({
            data: {
                teamId: input.teamId,
                ownerId: input.userId,
                icpId: ctx.icp?.id ?? null,
                name,
                description: `Drafted from the "${playbook.name}" playbook. Nothing is sent until you switch it on.`,
                status: "draft",
                aiConfig: {
                    dripPlaybook: {
                        kind: playbook.kind,
                        version: 1,
                        trigger: playbook.trigger.kind,
                        exits: playbook.exits,
                        links: { assetUrl: links.assetUrl ?? null, bookingUrl: links.bookingUrl ?? null },
                    },
                },
            },
            select: { id: true },
        });
        const sequence = await tx.campaignSequence.create({
            data: { teamId: input.teamId, campaignId: campaign.id, name, status: "DRAFT", timezone },
            select: { id: true },
        });
        await tx.sequenceStep.createMany({
            data: written.map((email, i) => ({
                teamId: input.teamId,
                sequenceId: sequence.id,
                stepOrder: i,
                stepType: "EMAIL",
                delayDays: playbook.emails[i]!.delayDays,
                delayHours: playbook.emails[i]!.delayHours ?? 0,
                subject: email.subject,
                body: email.body,
            })),
        });
        return { campaignId: campaign.id, sequenceId: sequence.id, emails: written.length };
    }, { timeout: 20_000 });
}
