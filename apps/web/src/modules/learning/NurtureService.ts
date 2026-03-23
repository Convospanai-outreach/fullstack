
const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

export class NurtureService {
    static async syncEvents(year: number = new Date().getFullYear() + 1) {
        try {
            const res = await fetch(`${API_URL}/nurture/sync-events`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ year })
            });
            return await res.json();
        } catch (error) {
            console.error("[NurtureService] Sync events proxy failed:", error);
            throw error;
        }
    }

    static async generateNurtureTasks(teamId: string, daysForward: number = 7) {
        try {
            const res = await fetch(`${API_URL}/nurture/generate-tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, daysForward })
            });
            return await res.json();
        } catch (error) {
            console.error("[NurtureService] Generate tasks proxy failed:", error);
            return { tasksCreated: 0 };
        }
    }
}
