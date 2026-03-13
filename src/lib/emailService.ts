
const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

export class EmailService {
    static async sendEmail(
        to: string,
        subject: string,
        body: string,
        fromName?: string,
        fromEmail?: string,
        teamId?: string
    ) {
        const res = await fetch(`${API_URL}/email/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to, subject, body, fromName, fromEmail, teamId })
        });
        return await res.json();
    }

    static async createVerificationToken(email: string): Promise<string> {
        const res = await fetch(`${API_URL}/email/verification-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        return data.token;
    }

    static async verifyToken(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
        const res = await fetch(`${API_URL}/email/verify-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })
        });
        return await res.json();
    }

    static async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
        await fetch(`${API_URL}/email/send-verification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, name, token })
        });
    }
}
