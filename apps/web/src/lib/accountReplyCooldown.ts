import { prisma } from "@/lib/db";
import { isSharedMailDomain, tryNormalizeDomain } from "@/lib/crm/domain";

export function accountReplyCooldownHours(settings: unknown): number {
    const hours = (settings as { accountReplyCooldownHours?: unknown } | null)?.accountReplyCooldownHours;
    return hours === 24 || hours === 48 || hours === 72 ? hours : 0;
}

export async function accountReplyHoldUntil(input: { teamId: string; leadId: string; domain?: string | null | undefined; settings: unknown; now?: Date }) {
    const hours = accountReplyCooldownHours(input.settings);
    if (!hours) return null;
    const domain = tryNormalizeDomain(input.domain);
    if (!domain || isSharedMailDomain(domain)) return null;
    const now = input.now ?? new Date();
    const duration = hours * 3_600_000;
    // Normalize legacy values at lookup as well as at write time. Keep this in sync with crm/domain.ts.
    const [reply] = await prisma.$queryRaw<{ createdAt: Date }[]>`
        SELECT message."createdAt"
        FROM "Message" AS message
        JOIN "Lead" AS lead ON lead.id = message."leadId"
        WHERE lead."teamId" = ${input.teamId} AND lead.id <> ${input.leadId}
          AND message.direction = 'INBOUND' AND message.platform = 'EMAIL'
          AND message."createdAt" > ${new Date(now.getTime() - duration)} AND message."createdAt" <= ${now}
          AND regexp_replace(regexp_replace(regexp_replace(
              substring(regexp_replace(lower(regexp_replace(lead.domain, '^[[:space:]]+|[[:space:]]+$', '', 'g')),
                  '^[a-z][a-z0-9+.-]*://', '') from '^[^/?#]*'), ':[0-9]+$', ''),
              '^www[.]', ''), '[.]$', '') = ${domain}
        ORDER BY message."createdAt" DESC
        LIMIT 1`;
    return reply ? new Date(reply.createdAt.getTime() + duration) : null;
}
