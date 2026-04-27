import { JobPayload } from "@/lib/queue";
import { EmailService } from "@/lib/emailService";

export async function handleEmailSend(payload: JobPayload) {
    if (!payload['email'] || !payload['subject'] || !payload['body']) {
        throw new Error("Missing required payload for EMAIL_SEND");
    }

    return await EmailService.sendEmail(payload['email'], payload['subject'], payload['body']);
}
