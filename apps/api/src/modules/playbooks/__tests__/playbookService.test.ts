import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
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

import { prisma } from "@/lib/db";
import { playbookService } from "../playbookService";

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
});
