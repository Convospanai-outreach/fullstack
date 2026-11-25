import { prisma } from "@/lib/db";
import { tryNormalizeDomain } from "@/lib/crm/domain";

// Company domains only. An address on a shared mail service is not an account identifier.
const sharedDomains = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "proton.me", "aol.com"]);

export function accountReplyCooldownHours(settings: unknown): number {
    const hours = (settings as { accountReplyCooldownHours?: unknown } | null)?.accountReplyCooldownHours;
    return hours === 24 || hours === 48 || hours === 72 ? hours : 0;
}

export async function accountReplyHoldUntil(input: { teamId: string; leadId: string; domain?: string | null | undefined; settings: unknown; now?: Date }) {
    const hours = accountReplyCooldownHours(input.settings);
    if (!hours) return null;
    const domain = tryNormalizeDomain(input.domain);
    if (!domain || sharedDomains.has(domain)) return null;
    const now = input.now ?? new Date();
    const duration = hours * 3_600_000;
    const reply = await prisma.message.findFirst({
        where: {
            direction: "INBOUND", platform: "EMAIL",
            createdAt: { gt: new Date(now.getTime() - duration), lte: now },
            lead: { teamId: input.teamId, domain: { equals: domain, mode: "insensitive" }, id: { not: input.leadId } },
        },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
    });
    return reply ? new Date(reply.createdAt.getTime() + duration) : null;
}
