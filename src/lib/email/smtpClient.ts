/**
 * SMTP Client Shell
 * Migrated to backend.
 */

export interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password?: string;
    fromName: string;
    fromEmail: string;
}

export const smtpClient = {
    sendMail: async (_options: any) => { 
        throw new Error("Email sending is only available on the backend."); 
    }
};

export async function sendViaSMTP(_config: SmtpConfig, _options: any): Promise<{ success: boolean; error?: string; messageId?: string }> {
    throw new Error("Email sending is only available on the backend.");
}
