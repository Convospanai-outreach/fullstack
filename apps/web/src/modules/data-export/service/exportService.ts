
const API_URL = (process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy");
const isServer = typeof window === "undefined";

function toCsv(rows: Record<string, any>[]): string {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0] ?? {});
    const escape = (value: any) => {
        const str = value == null ? "" : String(value);
        if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
            return `"${str.replace(/\"/g, "\"\"")}"`;
        }
        return str;
    };
    const lines = [
        headers.join(","),
        ...rows.map(row => headers.map(h => escape(row[h])).join(","))
    ];
    return lines.join("\n");
}

class ExportService {
    async generateCsv(entityType: "leads" | "campaigns", teamId: string) {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            if (entityType === "leads") {
                const leads = await prisma.lead.findMany({
                    where: { teamId },
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        company: true,
                        jobTitle: true,
                        status: true,
                        intentScore: true,
                        createdAt: true
                    }
                });
                return toCsv(leads as any);
            }
            const campaigns = await prisma.campaign.findMany({
                where: { teamId },
                select: {
                    id: true,
                    name: true,
                    status: true,
                    targetCount: true,
                    completedCount: true,
                    createdAt: true
                }
            });
            return toCsv(campaigns as any);
        }
        try {
            const res = await fetch(`${API_URL}/export/csv`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entityType, teamId })
            });
            if (!res.ok) throw new Error("Export proxy failure");
            const data = await res.json();
            return data.csv || "";
        } catch (error) {
            console.error("CSV export proxy failed:", error);
            return "";
        }
    }

    async generateJson(entityType: "leads" | "campaigns", teamId: string) {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            if (entityType === "leads") {
                const leads = await prisma.lead.findMany({ where: { teamId } });
                return JSON.stringify(leads, null, 2);
            }
            const campaigns = await prisma.campaign.findMany({ where: { teamId } });
            return JSON.stringify(campaigns, null, 2);
        }
        try {
            const res = await fetch(`${API_URL}/export/json`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entityType, teamId })
            });
            if (!res.ok) throw new Error("Export proxy failure");
            const data = await res.json();
            return JSON.stringify(data.json || [], null, 2);
        } catch (error) {
            console.error("JSON export proxy failed:", error);
            return "[]";
        }
    }
}

export const exportService = new ExportService();
