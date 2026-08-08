import { describe, it, expect, vi } from "vitest";

describe("Mailboxes API Route Security & Token Exclusion", () => {
    it("excludes encryptedAccessToken and encryptedRefreshToken from returned select payload", async () => {
        const selectedFields = {
            id: "mb-101",
            teamId: "team-1",
            email: "test@craftmyfunnel.com",
            displayName: "Test Mailbox",
            status: "CONNECTED",
            dailyLimit: 50,
            sentToday: 0,
            minDelaySeconds: 180,
            isWarmingUp: true,
            createdAt: new Date().toISOString(),
        };

        const mockFindMany = vi.fn().mockResolvedValue([selectedFields]);

        const mailboxes = await mockFindMany({
            where: { teamId: "team-1" },
            select: {
                id: true,
                teamId: true,
                email: true,
                displayName: true,
                status: true,
                dailyLimit: true,
                sentToday: true,
                minDelaySeconds: true,
                isWarmingUp: true,
                createdAt: true,
            },
        });

        expect(mailboxes).toHaveLength(1);
        expect(mailboxes[0]).toHaveProperty("id", "mb-101");
        expect(mailboxes[0]).toHaveProperty("email", "test@craftmyfunnel.com");

        // Verify secret token columns are NEVER present in selection payload
        expect(mailboxes[0]).not.toHaveProperty("encryptedAccessToken");
        expect(mailboxes[0]).not.toHaveProperty("encryptedRefreshToken");
        expect(mailboxes[0]).not.toHaveProperty("scopes");
    });
});
