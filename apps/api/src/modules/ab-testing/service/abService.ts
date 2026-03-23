import { prisma } from "@/lib/db";

type Variant = "A" | "B";
type ConversionType = "open" | "click" | "reply";

class ABService {
    assignVariant(leadId: string): Variant {
        const hash = Array.from(leadId).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        return hash % 2 === 0 ? "A" : "B";
    }

    async trackAssignment(teamId: string, leadId: string, variant: Variant) {
        await prisma.systemEvent.create({
            data: {
                teamId,
                type: "USER",
                name: "AB_SENT",
                actorId: "SYSTEM",
                payload: { leadId, variant }
            }
        });
    }

    async trackConversion(teamId: string, variant: Variant, type: ConversionType) {
        await prisma.systemEvent.create({
            data: {
                teamId,
                type: "USER",
                name: "AB_CONVERSION",
                actorId: "SYSTEM",
                payload: { variant, type }
            }
        });
        return true;
    }

    async getStats(teamId: string) {
        const events = await prisma.systemEvent.findMany({
            where: { teamId, name: { in: ["AB_SENT", "AB_CONVERSION"] } }
        });

        const stats = {
            A: { sent: 0, opens: 0, clicks: 0, replies: 0 },
            B: { sent: 0, opens: 0, clicks: 0, replies: 0 }
        };

        for (const ev of events) {
            const payload = ev.payload as any;
            const variant = payload?.variant as Variant | undefined;
            if (!variant || (variant !== "A" && variant !== "B")) continue;

            if (ev.name === "AB_SENT") {
                stats[variant].sent += 1;
                continue;
            }
            if (ev.name === "AB_CONVERSION") {
                const type = payload?.type as ConversionType | undefined;
                if (type === "open") stats[variant].opens += 1;
                if (type === "click") stats[variant].clicks += 1;
                if (type === "reply") stats[variant].replies += 1;
            }
        }

        return stats;
    }
}

export const abService = new ABService();
