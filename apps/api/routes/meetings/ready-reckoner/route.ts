import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError, successResponse, APIError } from "@/lib/apiResponse";
import { emailService } from "@/modules/email-campaigner";
import { z } from "zod";

const ReadyReckonerSchema = z.object({
    meetingId: z.string().optional(),
    clientName: z.string().trim().min(1, "Client name is required"),
    companyName: z.string().trim().min(1, "Company name is required"),
    industry: z.string().trim().min(1, "Industry is required"),
    competition: z.string().trim().optional(),
    meetingType: z.string().trim().min(1, "Meeting type is required"),
    meetingRemarks: z.string().trim().min(1, "Meeting remarks are required"),
    emailBackground: z.string().trim().optional(),
    linkedinBackground: z.string().trim().optional(),
    callBackground: z.string().trim().optional(),
    clientEmail: z.string().trim().email("Valid client email is required"),
    phoneNumber: z.string().trim().min(1, "Phone number is required"),
    send: z.boolean().optional().default(false),
});

function textOrFallback(value: string | undefined, fallback = "Not provided") {
    return value?.trim() ? value.trim() : fallback;
}

function escapeHtml(value: string) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function paragraphs(value: string) {
    return escapeHtml(value)
        .split(/\n{2,}/)
        .map((part) => `<p>${part.replace(/\n/g, "<br />")}</p>`)
        .join("");
}

function buildReadyReckonerEmail(input: z.infer<typeof ReadyReckonerSchema>, meetingTitle?: string) {
    const subject = `Meeting ready reckoner: ${input.clientName} - ${input.companyName}`;
    const meetingLine = meetingTitle ? `Meeting: ${meetingTitle}\n` : "";
    const competition = textOrFallback(input.competition, "No direct competitor mentioned");
    const emailBackground = textOrFallback(input.emailBackground);
    const linkedinBackground = textOrFallback(input.linkedinBackground);
    const callBackground = textOrFallback(input.callBackground);

    const text = [
        `Hi,`,
        ``,
        `Please find the ready reckoner for the upcoming meeting.`,
        ``,
        meetingLine +
        `Client: ${input.clientName}
Company: ${input.companyName}
Industry: ${input.industry}
Competition: ${competition}
Meeting type: ${input.meetingType}
Client email: ${input.clientEmail}
Client phone: ${input.phoneNumber}`,
        ``,
        `Caller remarks:
${input.meetingRemarks}`,
        ``,
        `Background from email:
${emailBackground}`,
        ``,
        `Background from LinkedIn:
${linkedinBackground}`,
        ``,
        `Background from calls:
${callBackground}`,
        ``,
        `Suggested meeting focus:
- Confirm the client's current priority and urgency.
- Reference the strongest discussion point from email, LinkedIn, or calls.
- Clarify competitor context if it affects timing, budget, or evaluation.
- Agree on next steps, owner, and timeline before closing the meeting.`,
        ``,
        `Regards,`
    ].join("\n");

    const html = `
        <p>Hi,</p>
        <p>Please find the ready reckoner for the upcoming meeting.</p>
        ${meetingTitle ? `<p><strong>Meeting:</strong> ${escapeHtml(meetingTitle)}</p>` : ""}
        <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;">
            <tr><td><strong>Client</strong></td><td>${escapeHtml(input.clientName)}</td></tr>
            <tr><td><strong>Company</strong></td><td>${escapeHtml(input.companyName)}</td></tr>
            <tr><td><strong>Industry</strong></td><td>${escapeHtml(input.industry)}</td></tr>
            <tr><td><strong>Competition</strong></td><td>${escapeHtml(competition)}</td></tr>
            <tr><td><strong>Meeting type</strong></td><td>${escapeHtml(input.meetingType)}</td></tr>
            <tr><td><strong>Client email</strong></td><td>${escapeHtml(input.clientEmail)}</td></tr>
            <tr><td><strong>Client phone</strong></td><td>${escapeHtml(input.phoneNumber)}</td></tr>
        </table>
        <h3>Caller remarks</h3>
        ${paragraphs(input.meetingRemarks)}
        <h3>Background from email</h3>
        ${paragraphs(emailBackground)}
        <h3>Background from LinkedIn</h3>
        ${paragraphs(linkedinBackground)}
        <h3>Background from calls</h3>
        ${paragraphs(callBackground)}
        <h3>Suggested meeting focus</h3>
        <ul>
            <li>Confirm the client's current priority and urgency.</li>
            <li>Reference the strongest discussion point from email, LinkedIn, or calls.</li>
            <li>Clarify competitor context if it affects timing, budget, or evaluation.</li>
            <li>Agree on next steps, owner, and timeline before closing the meeting.</li>
        </ul>
        <p>Regards,</p>
    `;

    return { subject, text, html };
}

export async function POST(req: NextRequest) {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
        }

        const validation = ReadyReckonerSchema.safeParse(await req.json());
        if (!validation.success) {
            throw new APIError(validation.error.issues[0]?.message ?? "Invalid input", 400, "VALIDATION_ERROR");
        }

        const input = validation.data;
        let meetingTitle: string | undefined;

        if (input.meetingId) {
            const meeting = await prisma.meeting.findFirst({
                where: { id: input.meetingId, teamId },
                select: { title: true },
            });
            if (!meeting) {
                throw new APIError("Meeting not found", 404, "MEETING_NOT_FOUND");
            }
            meetingTitle = meeting.title;
        }

        const draft = buildReadyReckonerEmail(input, meetingTitle);

        if (!input.send) {
            return successResponse({ draft, sent: false });
        }

        const result = await emailService.sendEmail(input.clientEmail, draft.subject, draft.html, { teamId });
        if (!result.success) {
            throw new APIError(result.error ?? "Failed to send ready reckoner email", 500, "EMAIL_SEND_FAILED");
        }

        return successResponse({ draft, sent: true, messageId: result.providerId ?? null });
    } catch (error) {
        return handleAPIError(error);
    }
}
