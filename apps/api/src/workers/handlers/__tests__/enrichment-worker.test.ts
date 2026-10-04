import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        campaign: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock("@/modules/scraper-bridge", () => ({
    scraperService: { scrape: vi.fn() },
}));

vi.mock("@/modules/hunter-email-finder", () => ({
    hunterService: { findAndStoreEmail: vi.fn() },
}));

vi.mock("@/lib/queue", () => ({
    JobQueue: { enqueue: vi.fn() },
}));

vi.mock("@/lib/credits", () => ({
    deductCredits: vi.fn(),
    refundCredits: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
    logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
    logWorker: vi.fn(),
}));

vi.mock("@/modules/scoring", () => ({
    leadScoringService: { scoreAndPersist: vi.fn() },
}));

vi.mock("@/modules/webhooks/service/webhookService", () => ({
    webhookService: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/crm/leadDataSource", () => ({
    recordLeadDataSources: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/extensionLeadCaptureService", () => ({
    enrollPendingSequence: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/modules/crystal-knows/service/crystalService", () => ({
    CrystalService: {
        findOrCreateProfile: vi.fn().mockResolvedValue({ state: "not_configured" }),
        generatePersonalityGuidance: vi.fn().mockResolvedValue(null),
    },
}));

import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { deductCredits, refundCredits } from "@/lib/credits";
import { hunterService } from "@/modules/hunter-email-finder";
import { recordLeadDataSources } from "@/lib/crm/leadDataSource";
import { CrystalService } from "@/modules/crystal-knows/service/crystalService";
import { enrollPendingSequence } from "@/services/extensionLeadCaptureService";
import { handleLeadEnrichment } from "../enrichment-worker";

describe("enrichment-worker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (deductCredits as any).mockResolvedValue(true);
    });

    it("throws when leadId is missing", async () => {
        await expect(handleLeadEnrichment({ teamId: "team-a" } as any)).rejects.toThrow(
            "Lead identifier (leadId) is missing in payload"
        );
    });

    it("throws when the lead can't be found", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue(null);

        await expect(
            handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any)
        ).rejects.toThrow("Lead lead-1 not found");
        expect(refundCredits).toHaveBeenCalledWith("team-a", 1, expect.stringContaining("lead-1"));
    });

    it("refuses to enrich a lead whose stored teamId doesn't match the enqueuing payload's teamId, and refunds credits", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({
            id: "lead-1",
            teamId: "team-b",
            fullName: "Jane Doe",
        });

        await expect(
            handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any)
        ).rejects.toThrow("Lead lead-1 does not belong to team team-a");
        expect(refundCredits).toHaveBeenCalledWith("team-a", 1, expect.stringContaining("lead-1"));
        expect(prisma.lead.update).not.toHaveBeenCalled();
    });

    it("enriches a lead whose teamId matches the payload's teamId", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({
            id: "lead-1",
            teamId: "team-a",
            fullName: "Jane Doe",
            linkedIn: null,
            email: "jane@example.com",
            company: null,
        });
        (prisma.lead.update as any).mockResolvedValue({});

        const result = await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

        expect(prisma.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-1" },
            data: { status: "enriched", isEnriched: true },
        });
        expect(refundCredits).not.toHaveBeenCalled();
        expect(result).toMatchObject({ leadId: "lead-1" });
    });

    it("enqueues an immediate email_sending job for a REALTIME-mode campaign (unchanged default behavior)", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({
            id: "lead-1",
            teamId: "team-a",
            fullName: "Jane Doe",
            linkedIn: null,
            email: "jane@example.com",
            company: null,
        });
        (prisma.lead.update as any).mockResolvedValue({});
        (prisma.campaign.findUnique as any).mockResolvedValue({ draftGenerationMode: "REALTIME" });

        await handleLeadEnrichment({ leadId: "lead-1", campaignId: "campaign-1", teamId: "team-a" } as any);

        expect(JobQueue.enqueue).toHaveBeenCalledWith(
            "email_sending",
            expect.objectContaining({ leadId: "lead-1", campaignId: "campaign-1" })
        );
        expect(prisma.campaign.update).not.toHaveBeenCalled();
    });

    it("BATCH mode: decrements enrichmentPending and does not enqueue an email_sending job directly", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({
            id: "lead-1",
            teamId: "team-a",
            fullName: "Jane Doe",
            linkedIn: null,
            email: "jane@example.com",
            company: null,
        });
        (prisma.lead.update as any).mockResolvedValue({});
        (prisma.campaign.findUnique as any).mockResolvedValue({ draftGenerationMode: "BATCH" });
        (prisma.campaign.update as any).mockResolvedValue({ enrichmentPending: 1, teamId: "team-a" });

        await handleLeadEnrichment({ leadId: "lead-1", campaignId: "campaign-1", teamId: "team-a" } as any);

        expect(prisma.campaign.update).toHaveBeenCalledWith({
            where: { id: "campaign-1" },
            data: { enrichmentPending: { decrement: 1 } },
            select: { enrichmentPending: true, teamId: true },
        });
        expect(JobQueue.enqueue).not.toHaveBeenCalledWith("email_sending", expect.anything());
        expect(JobQueue.enqueue).not.toHaveBeenCalledWith("EMAIL_DRAFT_BATCH_SUBMIT", expect.anything(), expect.anything());
    });

    it("BATCH mode: the enrichment job that brings enrichmentPending to 0 submits the campaign's draft batch", async () => {
        (prisma.lead.findUnique as any).mockResolvedValue({
            id: "lead-2",
            teamId: "team-a",
            fullName: "John Doe",
            linkedIn: null,
            email: "john@example.com",
            company: null,
        });
        (prisma.lead.update as any).mockResolvedValue({});
        (prisma.campaign.findUnique as any).mockResolvedValue({ draftGenerationMode: "BATCH" });
        (prisma.campaign.update as any).mockResolvedValue({ enrichmentPending: 0, teamId: "team-a" });

        await handleLeadEnrichment({ leadId: "lead-2", campaignId: "campaign-1", teamId: "team-a" } as any);

        expect(JobQueue.enqueue).toHaveBeenCalledWith(
            "EMAIL_DRAFT_BATCH_SUBMIT",
            { campaignId: "campaign-1", teamId: "team-a" },
            expect.objectContaining({ idempotencyKey: "batch_submit_campaign-1" })
        );
    });

    describe("Hunter enrichment - domain anchoring and full response persistence", () => {
        it("uses the lead's own canonical domain instead of guessing when one is already set", async () => {
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({
                    id: "lead-1",
                    teamId: "team-a",
                    fullName: "Jane Doe",
                    linkedIn: null,
                    email: null,
                    company: "Acme Corp",
                    domain: "acme.example",
                })
                .mockResolvedValueOnce({ enrichedData: null, company: "Acme Corp" });
            (prisma.lead.update as any).mockResolvedValue({});
            (hunterService.findAndStoreEmail as any).mockResolvedValue({ email: "jane@acme.example" });

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            expect(hunterService.findAndStoreEmail).toHaveBeenCalledWith(
                expect.objectContaining({ domain: "acme.example" })
            );
        });

        it("looks the person up by company name when the lead has no domain - no guessed domain", async () => {
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({
                    id: "lead-1",
                    teamId: "team-a",
                    fullName: "Jane Doe",
                    linkedIn: null,
                    email: null,
                    company: "Acme Corp",
                    domain: null,
                });
            (prisma.lead.update as any).mockResolvedValue({});
            (hunterService.findAndStoreEmail as any).mockResolvedValue({ email: null });

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            const query = (hunterService.findAndStoreEmail as any).mock.calls[0][0];
            expect(query).toEqual(expect.objectContaining({ firstName: "Jane", lastName: "Doe", company: "Acme Corp" }));
            expect(query.domain).toBeUndefined();
        });

        it("looks a captured profile up by its LinkedIn handle, without the placeholder name", async () => {
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({
                    id: "lead-1",
                    teamId: "team-a",
                    fullName: "Unknown LinkedIn Lead",
                    linkedIn: "https://www.linkedin.com/in/jane-doe/",
                    email: null,
                    company: null,
                    domain: null,
                    source: "chrome_extension",
                });
            (prisma.lead.update as any).mockResolvedValue({});
            (hunterService.findAndStoreEmail as any).mockResolvedValue({ email: null });

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            expect(hunterService.findAndStoreEmail).toHaveBeenCalledWith(
                expect.objectContaining({ firstName: "", lastName: "", linkedinHandle: "jane-doe" })
            );
            expect(CrystalService.findOrCreateProfile).toHaveBeenCalledWith(
                "team-a",
                expect.objectContaining({ full_name: undefined, linkedin_url: "https://www.linkedin.com/in/jane-doe/" }),
                expect.anything()
            );
        });

        it("fills an empty Lead.domain with the company domain Hunter resolved, and records it", async () => {
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({
                    id: "lead-1",
                    teamId: "team-a",
                    fullName: "Jane Doe",
                    linkedIn: "https://www.linkedin.com/in/jane-doe/",
                    email: null,
                    company: "Acme",
                    domain: null,
                    status: "LINKEDIN_CAPTURED",
                    source: "chrome_extension",
                })
                .mockResolvedValueOnce({ enrichedData: null, company: "Acme" });
            (prisma.lead.update as any).mockResolvedValue({});
            (hunterService.findAndStoreEmail as any).mockResolvedValue({
                email: "jane@acme.example", domain: "Acme.Example", phoneNumber: "+1 555 0100",
            });

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            const finalUpdate = (prisma.lead.update as any).mock.calls.find((call: any[]) => call[0].data.isEnriched)[0];
            expect(finalUpdate.data).toEqual(expect.objectContaining({ email: "jane@acme.example", domain: "acme.example" }));
            // The phone number stays in enrichedData.hunter only.
            expect(finalUpdate.data.phone).toBeUndefined();
            expect(recordLeadDataSources).toHaveBeenCalledWith(
                expect.arrayContaining([expect.objectContaining({ field: "domain", source: "HUNTER", value: "acme.example" })])
            );
        });

        it("doesn't send a webmail domain to Hunter, whatever its case, and looks up by company instead", async () => {
            (prisma.lead.findUnique as any).mockResolvedValueOnce({
                id: "lead-1",
                teamId: "team-a",
                fullName: "Jane Doe",
                linkedIn: null,
                email: null,
                company: "Acme",
                domain: "Gmail.com",
            });
            (prisma.lead.update as any).mockResolvedValue({});
            (hunterService.findAndStoreEmail as any).mockResolvedValue({ email: null });

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            const query = (hunterService.findAndStoreEmail as any).mock.calls[0][0];
            expect(query.domain).toBeUndefined();
            expect(query.company).toBe("Acme");
        });

        it("fills Lead.domain when Hunter resolves the company's domain but finds no email", async () => {
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({
                    id: "lead-1",
                    teamId: "team-a",
                    fullName: "Jane Doe",
                    linkedIn: null,
                    email: null,
                    company: "Acme",
                    domain: null,
                })
                .mockResolvedValueOnce({ enrichedData: null, company: "Acme" });
            (prisma.lead.update as any).mockResolvedValue({});
            (hunterService.findAndStoreEmail as any).mockResolvedValue({ email: null, domain: "acme.example" });

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            const finalUpdate = (prisma.lead.update as any).mock.calls.find((call: any[]) => call[0].data.isEnriched)[0];
            expect(finalUpdate.data.domain).toBe("acme.example");
            expect(finalUpdate.data.email).toBeUndefined();
        });

        it("doesn't take a webmail domain as the lead's company domain", async () => {
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({
                    id: "lead-1",
                    teamId: "team-a",
                    fullName: "Jane Doe",
                    linkedIn: "https://www.linkedin.com/in/jane-doe/",
                    email: null,
                    company: null,
                    domain: null,
                })
                .mockResolvedValueOnce({ enrichedData: null, company: null });
            (prisma.lead.update as any).mockResolvedValue({});
            (hunterService.findAndStoreEmail as any).mockResolvedValue({ email: "jane@gmail.com" });

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            const finalUpdate = (prisma.lead.update as any).mock.calls.find((call: any[]) => call[0].data.isEnriched)[0];
            expect(finalUpdate.data.domain).toBeUndefined();
        });

        it("persists Hunter's previously-discarded response fields under enrichedData.hunter and records provenance", async () => {
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({
                    id: "lead-1",
                    teamId: "team-a",
                    fullName: "Jane Doe",
                    linkedIn: null,
                    email: null,
                    company: null,
                    domain: "acme.example",
                })
                .mockResolvedValueOnce({ enrichedData: { existing: "value" }, company: null });
            (prisma.lead.update as any).mockResolvedValue({});
            (hunterService.findAndStoreEmail as any).mockResolvedValue({
                email: "jane@acme.example",
                score: 97,
                firstName: "Jane",
                lastName: "Doe",
                position: "VP Sales",
                company: "Acme Corp",
                sources: [{ domain: "acme.example" }],
            });

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            expect(prisma.lead.update).toHaveBeenCalledWith({
                where: { id: "lead-1" },
                data: {
                    enrichedData: {
                        existing: "value",
                        hunter: expect.objectContaining({
                            score: 97,
                            firstName: "Jane",
                            lastName: "Doe",
                            position: "VP Sales",
                            company: "Acme Corp",
                            sources: [{ domain: "acme.example" }],
                        }),
                    },
                },
            });
            // Company was empty on the lead, so Hunter's company promotes.
            expect(prisma.lead.update).toHaveBeenCalledWith({
                where: { id: "lead-1" },
                data: expect.objectContaining({ company: "Acme Corp" }),
            });
            expect(recordLeadDataSources).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ leadId: "lead-1", field: "email", source: "HUNTER" }),
                    expect.objectContaining({ leadId: "lead-1", field: "company", source: "HUNTER", value: "Acme Corp" }),
                ])
            );
        });

        it("never overwrites an existing company with Hunter's returned company", async () => {
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({
                    id: "lead-1",
                    teamId: "team-a",
                    fullName: "Jane Doe",
                    linkedIn: null,
                    email: null,
                    company: "Original Company",
                    domain: "acme.example",
                })
                .mockResolvedValueOnce({ enrichedData: null, company: "Original Company" });
            (prisma.lead.update as any).mockResolvedValue({});
            (hunterService.findAndStoreEmail as any).mockResolvedValue({
                email: "jane@acme.example",
                company: "Different Company From Hunter",
            });

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            const finalUpdateCall = (prisma.lead.update as any).mock.calls.find(
                (call: any[]) => call[0].data.status === "enriched"
            );
            expect(finalUpdateCall[0].data.company).toBeUndefined();
        });
    });

    describe("leads the Chrome extension captured", () => {
        it("starts the sequence chosen in the extension once Hunter finds an email, and not before", async () => {
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({ id: "lead-1", teamId: "team-a", fullName: "Jane Doe", linkedIn: "https://www.linkedin.com/in/jane-doe/", email: null, company: "Acme", domain: null })
                .mockResolvedValueOnce({ enrichedData: null, company: "Acme" });
            (prisma.lead.update as any).mockResolvedValue({});
            (hunterService.findAndStoreEmail as any).mockResolvedValue({ email: "jane@acme.example" });

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);
            expect(enrollPendingSequence).toHaveBeenCalledWith("lead-1");

            vi.clearAllMocks();
            (deductCredits as any).mockResolvedValue(true);
            (prisma.lead.findUnique as any).mockResolvedValueOnce({ id: "lead-1", teamId: "team-a", fullName: "Jane Doe", linkedIn: "https://www.linkedin.com/in/jane-doe/", email: null, company: "Acme", domain: null });
            (prisma.lead.update as any).mockResolvedValue({});
            (hunterService.findAndStoreEmail as any).mockResolvedValue({ email: null });

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);
            expect(enrollPendingSequence).not.toHaveBeenCalled();
        });

        it("keeps a status further along than NEW and skips the server-side LinkedIn scrape", async () => {
            const { scraperService } = await import("@/modules/scraper-bridge");
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                teamId: "team-a",
                fullName: "Jane Doe",
                linkedIn: "https://www.linkedin.com/in/jane-doe/",
                email: "jane@acme.example",
                company: "Acme",
                status: "LINKEDIN_CAPTURED",
                enrichedData: { extensionCapture: { source: "chrome_extension" } },
            });
            (prisma.lead.update as any).mockResolvedValue({});

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            expect(scraperService.scrape).not.toHaveBeenCalled();
            const finalUpdate = (prisma.lead.update as any).mock.calls.find((call: any[]) => call[0].data.isEnriched)[0];
            expect(finalUpdate.data.status).toBeUndefined();
        });

        it("still moves a NEW lead to enriched and scrapes a lead that didn't come from the extension", async () => {
            const { scraperService } = await import("@/modules/scraper-bridge");
            (scraperService.scrape as any).mockResolvedValue({ success: false });
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                teamId: "team-a",
                fullName: "Jane Doe",
                linkedIn: "https://www.linkedin.com/in/jane-doe/",
                email: "jane@acme.example",
                company: "Acme",
                status: "NEW",
            });
            (prisma.lead.update as any).mockResolvedValue({});

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            expect(scraperService.scrape).toHaveBeenCalled();
            const finalUpdate = (prisma.lead.update as any).mock.calls.find((call: any[]) => call[0].data.isEnriched)[0];
            expect(finalUpdate.data.status).toBe("enriched");
        });
    });

    describe("Crystal Knows personality enrichment", () => {
        it("skips silently (no lead write, no error) when the team has no Crystal API key configured", async () => {
            (CrystalService.findOrCreateProfile as any).mockResolvedValue({ state: "not_configured" });
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                teamId: "team-a",
                fullName: "Jane Doe",
                linkedIn: null,
                email: "jane@example.com",
                company: null,
            });
            (prisma.lead.update as any).mockResolvedValue({});

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            expect(prisma.lead.update).not.toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ enrichedData: expect.anything() }) })
            );
        });

        it("persists the found profile under enrichedData.crystalKnows and records provenance", async () => {
            (CrystalService.findOrCreateProfile as any).mockResolvedValue({
                state: "found",
                profile: { id: "profile-1", personalities: { disc_type: "D" } },
            });
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({
                    id: "lead-1",
                    teamId: "team-a",
                    fullName: "Jane Doe",
                    linkedIn: null,
                    email: "jane@example.com",
                    company: null,
                })
                .mockResolvedValueOnce({ enrichedData: { existing: "value" } });
            (CrystalService.generatePersonalityGuidance as any).mockResolvedValueOnce({
                prompt: "Be direct.",
                discType: "D",
                archetype: "Driver",
            });
            (prisma.lead.update as any).mockResolvedValue({});

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            expect(CrystalService.generatePersonalityGuidance).toHaveBeenCalledWith("team-a", expect.objectContaining({ id: "profile-1" }));
            expect(prisma.lead.update).toHaveBeenCalledWith({
                where: { id: "lead-1" },
                data: {
                    enrichedData: {
                        existing: "value",
                        crystalKnows: expect.objectContaining({
                            profileId: "profile-1",
                            personalities: { disc_type: "D" },
                            guidance: { prompt: "Be direct.", discType: "D", archetype: "Driver" },
                        }),
                    },
                },
            });
            expect(recordLeadDataSources).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({ leadId: "lead-1", source: "CRYSTAL_KNOWS", value: "profile-1" }),
                ])
            );
        });

        it("still persists the profile (guidance null) when guidance generation fails", async () => {
            (CrystalService.findOrCreateProfile as any).mockResolvedValue({ state: "found", profile: { id: "profile-1" } });
            (CrystalService.generatePersonalityGuidance as any).mockResolvedValueOnce(null);
            (prisma.lead.findUnique as any)
                .mockResolvedValueOnce({ id: "lead-1", teamId: "team-a", fullName: "Jane Doe", linkedIn: null, email: "jane@example.com", company: null })
                .mockResolvedValueOnce({ enrichedData: {} });
            (prisma.lead.update as any).mockResolvedValue({});

            await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            expect(prisma.lead.update).toHaveBeenCalledWith({
                where: { id: "lead-1" },
                data: { enrichedData: { crystalKnows: expect.objectContaining({ profileId: "profile-1", guidance: null }) } },
            });
        });

        it("does not fail enrichment when the Crystal lookup errors", async () => {
            (CrystalService.findOrCreateProfile as any).mockRejectedValue(new Error("Crystal API down"));
            (prisma.lead.findUnique as any).mockResolvedValue({
                id: "lead-1",
                teamId: "team-a",
                fullName: "Jane Doe",
                linkedIn: null,
                email: "jane@example.com",
                company: null,
            });
            (prisma.lead.update as any).mockResolvedValue({});

            const result = await handleLeadEnrichment({ leadId: "lead-1", teamId: "team-a" } as any);

            expect(result).toMatchObject({ leadId: "lead-1" });
        });
    });
});
