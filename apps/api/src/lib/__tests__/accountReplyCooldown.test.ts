import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSharedMailDomain, WEBMAIL_DOMAINS } from "../crm/domain";
import { isSharedMailDomain as isWebSharedMailDomain, WEBMAIL_DOMAINS as WEB_WEBMAIL_DOMAINS } from "../../../../web/src/lib/crm/domain";
import { accountReplyHoldUntil } from "../accountReplyCooldown";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRaw } }));

const now = new Date("2026-11-25T10:00:00Z");
const input = { teamId: "team-a", leadId: "lead-a", domain: "www.example.com", settings: { accountReplyCooldownHours: 24 }, now };

describe("account reply cooldown", () => {
    beforeEach(() => vi.resetAllMocks());

    it("holds sends until the latest reply by another contact at the same team account expires", async () => {
        const yesterday = new Date("2026-11-24T10:00:00Z");
        queryRaw.mockResolvedValue([{ createdAt: new Date("2026-11-25T08:00:00Z") }]);
        await expect(accountReplyHoldUntil({ ...input, domain: " HTTPS://WWW.Example.COM.:443/path " }))
            .resolves.toEqual(new Date("2026-11-26T08:00:00Z"));
        expect(queryRaw).toHaveBeenCalledWith(expect.any(Array), "team-a", "lead-a", yesterday, now, "example.com");
        const sql = queryRaw.mock.calls[0]![0].join("?");
        for (const pattern of ["lower(", "://", "[^/?#]*", ":[0-9]+$", "^www[.]", "[.]$"]) {
            expect(sql).toContain(pattern);
        }
    });

    it("does not look for collisions when disabled or on a shared mailbox domain", async () => {
        await expect(accountReplyHoldUntil({ ...input, settings: null })).resolves.toBeNull();
        await expect(accountReplyHoldUntil({ ...input, domain: "gmail.com" })).resolves.toBeNull();
        expect(queryRaw).not.toHaveBeenCalled();
    });

    it("excludes the same shared mail domains in both deployables", async () => {
        expect([...WEBMAIL_DOMAINS].sort()).toEqual([...WEB_WEBMAIL_DOMAINS].sort());
        const shared = [
            "protonmail.com", "pm.me", "gmx.com", "gmx.net", "gmx.de", "mail.com", "zoho.com",
            "yandex.com", "yandex.ru", "fastmail.com", "hey.com", "msn.com", "me.com", "mac.com",
            "qq.com", "163.com", "126.com", "rediffmail.com", "outlook.co.uk", "yahoo.co.in",
            "hotmail.co.uk", "live.fr", "gmail.de",
        ];
        for (const domain of shared) {
            expect(isSharedMailDomain(domain), domain).toBe(true);
            expect(isWebSharedMailDomain(domain), domain).toBe(true);
            await expect(accountReplyHoldUntil({ ...input, domain })).resolves.toBeNull();
        }
        for (const domain of ["example.com", "yahoo.example.com", "hotmail.solutions"]) {
            expect(isSharedMailDomain(domain), domain).toBe(false);
            expect(isWebSharedMailDomain(domain), domain).toBe(false);
        }
        expect(queryRaw).not.toHaveBeenCalled();
    });
});
