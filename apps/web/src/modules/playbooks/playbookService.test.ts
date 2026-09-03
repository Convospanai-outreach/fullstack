import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
    prisma: {
        playbook: {
            findFirst: vi.fn(),
        },
        campaign: {
            create: vi.fn(),
        },
        campaignVariant: {
            createMany: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/prisma";
import { playbookService } from "./playbookService";

describe("playbookService.instantiatePlaybook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("scopes the playbook lookup to the requesting team (IDOR guard)", async () => {
        (prisma.playbook.findFirst as any).mockResolvedValue(null);

        await expect(
            playbookService.instantiatePlaybook("other-teams-playbook-id", "my-team-id", {})
        ).rejects.toThrow("Playbook not found");

        expect(prisma.playbook.findFirst).toHaveBeenCalledWith({
            where: { id: "other-teams-playbook-id", teamId: "my-team-id" },
        });
    });

    it("instantiates a playbook owned by the requesting team", async () => {
        (prisma.playbook.findFirst as any).mockResolvedValue({
            id: "p1",
            teamId: "my-team-id",
            name: "Outreach Basics",
            config: { emails: [{ subject: "Hi {{name}}", body: "Hello {{name}}" }] },
        });
        (prisma.campaign.create as any).mockResolvedValue({ id: "c1", name: "Outreach Basics (Instance)" });

        const campaign = await playbookService.instantiatePlaybook("p1", "my-team-id", { name: "Acme" });

        expect(campaign).toEqual({ id: "c1", name: "Outreach Basics (Instance)" });
        expect(prisma.campaignVariant.createMany).toHaveBeenCalledWith({
            data: [{ campaignId: "c1", subject: "Hi Acme", body: "Hello Acme", weight: 100 }],
        });
    });

    it("does not treat a literal $ in a substituted value as a special replacement pattern", async () => {
        (prisma.playbook.findFirst as any).mockResolvedValue({
            id: "p1",
            teamId: "my-team-id",
            name: "Pricing Outreach",
            config: { emails: [{ subject: "Offer for {{company}}", body: "Price: {{price}}" }] },
        });
        (prisma.campaign.create as any).mockResolvedValue({ id: "c1", name: "Pricing Outreach (Instance)" });

        await playbookService.instantiatePlaybook("p1", "my-team-id", {
            company: "Acme",
            price: "$5,000 (was $&)",
        });

        expect(prisma.campaignVariant.createMany).toHaveBeenCalledWith({
            data: [{ campaignId: "c1", subject: "Offer for Acme", body: "Price: $5,000 (was $&)", weight: 100 }],
        });
    });

    it("does not throw or misbehave when a parameter key contains regex metacharacters", async () => {
        (prisma.playbook.findFirst as any).mockResolvedValue({
            id: "p1",
            teamId: "my-team-id",
            name: "Weird Key",
            config: { emails: [{ subject: "Hi {{first.name}}", body: "Hello {{first.name}}" }] },
        });
        (prisma.campaign.create as any).mockResolvedValue({ id: "c1", name: "Weird Key (Instance)" });

        await playbookService.instantiatePlaybook("p1", "my-team-id", { "first.name": "Jordan" });

        expect(prisma.campaignVariant.createMany).toHaveBeenCalledWith({
            data: [{ campaignId: "c1", subject: "Hi Jordan", body: "Hello Jordan", weight: 100 }],
        });
    });
});
