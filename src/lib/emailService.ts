import { sendEmailViaSendPulse } from "@/integrations/sendpulse";

export class EmailService {
    static async sendEmail(
        to: string,
        subject: string,
        body: string,
        fromName?: string,
        fromEmail?: string
    ) {
        console.log(`[EmailService] Sending email to ${to}`);

        // Use provided sender, or env vars, or fallback
        const senderName = fromName || process.env['SMTP_FROM_NAME'] || "ConvoSpan User";
        const senderEmail = fromEmail || process.env['SMTP_FROM_EMAIL'] || "noreply@convospan.com";

        try {
            const result = await sendEmailViaSendPulse(to, subject, body, senderName, senderEmail);
            return { success: true, result };
        } catch (error: any) {
            console.error("[EmailService] Failed to send email:", error);
            // Fallback to mock if SendPulse fails (for dev/demo reliability)
            // In prod, you might want to throw error
            return { success: false, error: error.message || error };
        }
    }
}
