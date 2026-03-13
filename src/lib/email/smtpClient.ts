/**
 * SMTP Client Shell
 * Migrated to backend.
 */
export const smtpClient = {
    sendMail: async (_options: any) => { throw new Error("Email sending is only available on the backend."); }
};
