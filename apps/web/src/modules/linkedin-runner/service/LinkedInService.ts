
const API_URL = (process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy");

export class LinkedInService {
    static async sendConnectionRequest(leadId: string, _teamId: string, _userId: string, message?: string) {
        try {
            const res = await fetch(`${API_URL}/linkedin/connect`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId, teamId: _teamId, userId: _userId, message })
            });
            if (!res.ok) throw new Error("LinkedIn proxy failure");
            return await res.json();
        } catch (error) {
            console.error("[LinkedInService] Connection proxy failed:", error);
            throw error;
        }
    }

    static async checkConnectionStatus(leadId: string): Promise<boolean> {
        try {
            const res = await fetch(`${API_URL}/linkedin/status?leadId=${leadId}`);
            if (!res.ok) return false;
            const data = await res.json();
            return !!data.connected;
        } catch {
            return false;
        }
    }
}
