import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { parseBody } from "@/lib/validation/parseBody";
import { composeNodeA } from "@/modules/email-campaigner/service/emailComposer";
import { buildAudienceContext } from "@/modules/email-campaigner/service/audienceContext";

const bodySchema = z.object({
    kind: z.enum(["first", "followUp"]).default("first"),
    instruction: z.string().max(300).optional(),
    existingSubject: z.string().max(300).optional(),
    existingBody: z.string().max(1500).optional(),
});

const rec = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

// Suggests copy for one email step of a sequence. The operator's own text is never replaced here:
// the result goes back to the step editor as a suggestion to edit, and nothing is sent. The draft
// is a template for every recipient, so it is written with merge fields, from the campaign's brief,
// style settings and saved ICP (including its target markets), not from any one lead.
// Billed like any other AI draft.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        await authorizeRole(userId, teamId, TeamRole.MEMBER);

        const campaign = await prisma.campaign.findFirst({
            where: { id, teamId },
            select: { name: true, aiConfig: true, icp: true, team: { select: { name: true, aiConfig: true } } },
        });
        if (!campaign) throw new APIError("Campaign not found", 404, "NOT_FOUND");

        const parsed = await parseBody(req, bodySchema);
        if (!parsed.ok) return parsed.response;
        const { kind, instruction, existingSubject, existingBody } = parsed.data;

        const config = rec(campaign.aiConfig);
        const teamConfig = rec(campaign.team?.aiConfig);
        const pick = (key: string) => str(config[key]) ?? str(teamConfig[key]);
        const brief = str(config["context"]);

        const constraints = [
            pick("constraints"),
            "This email is a template sent to many recipients. Greet them with {{firstName|there}} and refer to their company only as {{company|your company}}. Use no other personal details and no other merge fields.",
            kind === "followUp" ? "This is a follow-up in a sequence: a new angle, never 'just following up'." : null,
            existingBody ? `Improve this draft without changing what it offers:\nSubject: ${existingSubject ?? ""}\n${existingBody}` : null,
            instruction ? `The sender asks: ${instruction}` : null,
        ].filter(Boolean).join("\n");

        const draft = await composeNodeA(
            {
                prospect_name: "{{firstName|there}}",
                prospect_title: "{{jobTitle|your role}}",
                prospect_company: "{{company|your company}}",
                pain_context: str(config["painContext"]) ?? brief ?? str(campaign.icp?.description) ?? "Improving sales efficiency",
                outreach_timing: "Template for every recipient of the sequence",
                avoid_topics: Array.isArray(config["avoidTopics"]) ? (config["avoidTopics"] as string[]) : [],
                hypothesis: str(config["hypothesis"]) ?? brief ?? "Your team wants a faster way to reach the right buyers",
                signal_type: "Campaign brief",
                extracted_signal: brief ?? campaign.name,
                sender_name: campaign.team?.name || "CraftMyFunnel Team",
                sender_email: "contact.us@craftmyfunnel.live",
                tone: pick("tone"),
                voice: pick("voice"),
                formulation: pick("formulation"),
                greeting_style: pick("greetingStyle"),
                sign_off: pick("signOff"),
                cta_style: pick("ctaStyle"),
                constraints,
                audience_context: buildAudienceContext({ icp: campaign.icp, lead: null }),
            },
            teamId,
        );

        return NextResponse.json({ ok: true, subject: draft.subject, body: draft.body, reviewed: !draft.unreviewed });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("Insufficient credits")) {
            return NextResponse.json({ error: message, code: "INSUFFICIENT_CREDITS" }, { status: 402 });
        }
        return handleAPIError(error);
    }
}
