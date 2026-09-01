import { prisma } from "@/lib/db";
import Papa from "papaparse";
import { ConsentService, ConsentMethod } from "@/modules/whatsapp/ConsentService";

export interface ConsentAttestation {
    userId: string;
    hasConsent: boolean;
}

// Rows are processed sequentially (a findFirst + create/update per row) - an unbounded
// CSV would tie up the request/worker indefinitely.
const MAX_ROWS = 5000;

export interface CSVRow {
    email: string;
    fullName?: string;
    company?: string;
    jobTitle?: string;
    linkedIn?: string;
    location?: string;
}

class CSVIngestionService {
    /**
     * Get AI-suggested mapping for CSV headers
     */
    async suggestMapping(headers: string[]) {
        // Simple heuristic fallback
        return this.autoDetectFieldMapping(headers);
    }

    /**
     * Simple client-side auto-detection fallback
     */
    autoDetectFieldMapping(headers: string[]): Record<string, string> {
        const mapping: Record<string, string> = {};
        headers.forEach(h => {
            const nh = h.toLowerCase().replace(/[\s_]+/g, '');
            if (nh.includes('email') || nh === 'mail') mapping[h] = 'email';
            else if (nh.includes('name') || nh === 'fullname' || nh === 'contactname') mapping[h] = 'fullName';
            else if (nh.includes('linkedin') || nh.includes('profile')) mapping[h] = 'linkedIn';
            else if (nh.includes('company') || nh === 'org') mapping[h] = 'company';
            else if (nh.includes('title') || nh.includes('role')) mapping[h] = 'jobTitle';
            else if (nh.includes('location') || nh.includes('city')) mapping[h] = 'location';
        });
        return mapping;
    }

    async processCSV(csvContent: string, teamId: string | null, mapping?: Record<string, string>, campaignId?: string, consent?: ConsentAttestation) {
        try {
            const parsed = Papa.parse(csvContent, {
                header: true,
                skipEmptyLines: true,
            });

            if (parsed.errors.length > 0) {
                return {
                    success: false,
                    created: 0,
                    skipped: 0,
                    errors: parsed.errors.map(e => ({ message: e.message })),
                    totalParsed: 0,
                    inserted: 0
                };
            }

            // campaignId is caller-supplied - verify it actually belongs to this team
            // before linking any imported lead to it, or a caller could attach their
            // leads to (and pollute the stats of) another tenant's campaign.
            if (campaignId) {
                const campaign = await prisma.campaign.findFirst({
                    where: { id: campaignId, teamId: teamId || undefined },
                    select: { id: true },
                });
                if (!campaign) {
                    campaignId = undefined;
                }
            }

            if ((parsed.data as unknown[]).length > MAX_ROWS) {
                return {
                    success: false,
                    created: 0,
                    skipped: 0,
                    errors: [{ message: `CSV has too many rows (${(parsed.data as unknown[]).length}). Maximum is ${MAX_ROWS} - split the file and import in batches.` }],
                    totalParsed: 0,
                    inserted: 0
                };
            }

            const headers = parsed.meta.fields || [];
            const activeMapping = mapping || this.autoDetectFieldMapping(headers);

            // Find mapping keys
            const emailKey = Object.keys(activeMapping).find(k => activeMapping[k] === 'email');
            const fullNameKey = Object.keys(activeMapping).find(k => activeMapping[k] === 'fullName');
            const companyKey = Object.keys(activeMapping).find(k => activeMapping[k] === 'company');
            const jobTitleKey = Object.keys(activeMapping).find(k => activeMapping[k] === 'jobTitle');
            const linkedInKey = Object.keys(activeMapping).find(k => activeMapping[k] === 'linkedIn');
            const locationKey = Object.keys(activeMapping).find(k => activeMapping[k] === 'location');

            let created = 0;
            let skipped = 0;
            const errors: Array<{ message: string }> = [];

            const rows = parsed.data as Array<Record<string, string>>;

            for (const row of rows) {
                try {
                    const rawEmail = emailKey ? row[emailKey] : undefined;
                    const email = rawEmail ? rawEmail.trim().toLowerCase() : undefined;

                    if (!email) {
                        errors.push({ message: `Row ${created + skipped + 1}: Missing email address` });
                        skipped++;
                        continue;
                    }

                    // Check if email format is basic valid
                    if (!email.includes("@")) {
                        errors.push({ message: `Row ${created + skipped + 1}: Invalid email format "${email}"` });
                        skipped++;
                        continue;
                    }

                    const existing = await prisma.lead.findFirst({
                        where: {
                            email,
                            teamId: teamId || undefined,
                        }
                    });

                    if (existing) {
                        if (campaignId) {
                            await prisma.lead.update({
                                where: { id: existing.id },
                                data: {
                                    campaignId,
                                    fullName: fullNameKey ? row[fullNameKey]?.trim() || existing.fullName || undefined : undefined,
                                    company: companyKey ? row[companyKey]?.trim() || existing.company || undefined : undefined,
                                },
                            });
                            created++;
                        } else {
                            skipped++;
                        }
                        continue;
                    }

                    const fullName = fullNameKey ? row[fullNameKey]?.trim() : undefined;
                    const company = companyKey ? row[companyKey]?.trim() : undefined;
                    const jobTitle = jobTitleKey ? row[jobTitleKey]?.trim() : undefined;
                    const linkedIn = linkedInKey ? row[linkedInKey]?.trim() : undefined;
                    const location = locationKey ? row[locationKey]?.trim() : undefined;

                    const createdLead = await prisma.lead.create({
                        data: {
                            email,
                            fullName,
                            company,
                            jobTitle,
                            linkedIn,
                            location,
                            teamId: teamId || undefined,
                            campaignId: campaignId || undefined,
                            status: "NEW",
                        }
                    });

                    if (consent?.hasConsent) {
                        // DPDP Act 2023 / GDPR: log the importer's attestation of consent to the ledger.
                        // Non-blocking — a logging failure shouldn't fail the row's lead creation.
                        await ConsentService.recordConsent(
                            createdLead.id,
                            consent.userId,
                            ConsentMethod.WEB_FORM,
                            "Attested by importer during CSV import",
                            "EMAIL"
                        ).catch((e) => {
                            console.warn("[CSVIngestion] Failed to record consent ledger entry:", e?.message || e);
                        });
                    }

                    created++;
                } catch (e: any) {
                    errors.push({ message: `Row ${created + skipped + 1}: ${e.message || "Failed to save lead"}` });
                    skipped++;
                }
            }

            // If leads were linked to a campaign, update its targetCount
            if (campaignId && created > 0) {
                try {
                    const totalLeadsInCampaign = await prisma.lead.count({ where: { campaignId } });
                    await prisma.campaign.update({
                        where: { id: campaignId },
                        data: { targetCount: totalLeadsInCampaign },
                    });
                } catch (e: any) {
                    console.warn("[CSVIngestion] Could not update campaign targetCount:", e.message);
                }
            }

            return {
                success: true,
                created,
                skipped,
                errors,
                totalParsed: rows.length,
                inserted: created
            };
        } catch (error: any) {
            console.error("Local CSV processing failed:", error);
            return {
                success: false,
                created: 0,
                skipped: 0,
                errors: [{ message: error.message || "Server-side processing failed" }],
                totalParsed: 0,
                inserted: 0
            };
        }
    }
}

export const csvIngestionService = new CSVIngestionService();

