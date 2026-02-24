
import { prisma } from "@/lib/db";
import * as XLSX from 'xlsx';
import { Lead } from "@prisma/client";
import { modelGateway } from "@/ai/ModelGateway";
import { EventStore, SystemEventType } from "./EventStore";
import { JobQueue } from "@/lib/queue";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";

interface ExcelRow {
    Name: string;
    Email: string;
    Company: string;
    Industry?: string;
    JobTitle?: string;
}

// Proprietary "Industry Wins" Database (The Moat)
// In a real app, this would be a DB table (e.g., CaseStudy model)
const INDUSTRY_WINS: Record<string, { painPoints: string[], winningAngle: string }> = {
    "SaaS": {
        painPoints: ["Churn reduction", "CAC payback period", "Feature adoption"],
        winningAngle: "We help reduce churn by predicting user drop-off before it happens."
    },
    "Healthcare": {
        painPoints: ["Compliance overhead", "Patient data security", "Staff burnout"],
        winningAngle: "Our platform automates 40% of administrative tasks, reducing staff burnout."
    },
    "Manufacturing": {
        painPoints: ["Supply chain disruption", "Equipment downtime", "Quality control"],
        winningAngle: "Predictive maintenance to eliminate unplanned downtime."
    },
    "Finance": {
        painPoints: ["Regulatory compliance", "Fraud detection", "Customer trust"],
        winningAngle: "Real-time fraud detection without compromising user experience."
    }
};

export class DataIngestionService {

    /**
     * Step 1: Ingest File (Excel, CSV, ODS, etc.) and Create/Update Leads
     * Step 2: Enrich with Proprietary Signals
     * Step 3: Trigger Initial Generation (Beta Run)
     */
    async processFileUpload(teamId: string, filePath: string, region: Region = Region.GLOBAL, campaignId?: string) {
        // Use DbFactory to respect Data Residency (UAE vs EU vs Global)
        const targetPrisma = DbFactory.getClient(region);

        // 1. Parse File (Supports .xlsx, .csv, .ods, .xls, etc.)
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) return [];
        const sheet = workbook.Sheets[sheetName];

        if (!sheet) return []; 

        const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet);

        console.log(`[DataIngestion] Processing ${rows.length} rows from ${filePath} for team ${teamId} in region ${region}`);

        const results = [];

        for (const row of rows) {
            try {
                // 2. Middle-Layer Logic: Inject Proprietary Signals
                const extraction = await this.enrichLeadData(row);

                // [NEW] Sovereign Firewall: Mask PII before storage
                console.log(`[DataIngestion] Masking PII for lead ${extraction.email}`);
                const { safeContext, tokenMap } = await SovereignFirewall.mask({
                    name: extraction.name,
                    email: extraction.email,
                    company: extraction.company,
                    jobTitle: extraction.jobTitle
                }, region);

                const maskedData = JSON.parse(safeContext);

                // 3. Store in DB (Regional Client)
                const existingLead = await targetPrisma.lead.findFirst({
                    where: {
                        email: maskedData.email,
                        teamId: teamId
                    }
                });

                let lead;

                if (existingLead) {
                    lead = await targetPrisma.lead.update({
                        where: { id: existingLead.id },
                        data: {
                            company: maskedData.company,
                            jobTitle: maskedData.jobTitle || null,
                            ...(extraction.industry && { tags: { push: extraction.industry } }),
                            campaignId: campaignId || null,
                        }
                    });
                } else {
                    lead = await targetPrisma.lead.create({
                        data: {
                            email: maskedData.email,
                            fullName: maskedData.name,
                            company: maskedData.company,
                            jobTitle: maskedData.jobTitle || null,
                            teamId: teamId,
                            campaignId: campaignId || null,
                            status: "NEW",
                            isEnriched: true,
                            enrichedData: extraction.proprietarySignal as any,
                            tags: extraction.industry ? [extraction.industry] : []
                        }
                    });
                }

                // 4. TRIGGER ASYNCHRONOUS ENRICHMENT (Scalability)
                await JobQueue.enqueue("lead_enrichment", {
                    leadId: lead.id,
                    teamId: teamId,
                    region: region, // Pass region to background job
                    campaignId: campaignId || undefined,
                    extraction: extraction 
                });

                // [NEW] Record Lead Ingestion Event
                await EventStore.record({
                    type: SystemEventType.SYSTEM, 
                    name: "LEAD_INGESTED",
                    teamId: teamId,
                    payload: {
                        leadId: lead.id,
                        leadEmail: lead.email,
                        source: "FILE_UPLOAD",
                        filename: filePath,
                        region
                    }
                });

                results.push({ email: lead.email, status: "SUCCESS" });

            } catch (error: any) {
                console.error(`[DataIngestion] Failed row ${row.Email || 'Unknown'}:`, error);
                results.push({ email: row.Email || 'Unknown', status: "FAILED", error: error.message });
            }
        }

        return results;
    }

    /**
     * "The Enrichment Injection"
     * Looks up proprietary data to create a stronger prompt payload.
     */
    private async enrichLeadData(row: ExcelRow) {
        // Fallbacks for CSVs which might have different headers (case sensitive)
        // We normalize common variations if needed, or assume standard template
        const industry = row.Industry || "Generic";
        const signal = INDUSTRY_WINS[industry] || {
            painPoints: ["Efficiency", "Growth"],
            winningAngle: "Improve your operational efficiency."
        };

        return {
            name: row.Name,
            email: row.Email,
            company: row.Company,
            jobTitle: row.JobTitle, // This is potentially undefined
            industry: industry,
            proprietarySignal: {
                targetIndustry: industry,
                topPainPoint: signal.painPoints[0], // Picking the top one for the prompt
                winningAngle: signal.winningAngle,
                source: "ConvoSpan Proprietary Index 2026"
            }
        };
    }

    /**
     * Entry point for background worker to perform heavy AI enrichment.
     */
    async processEnrichmentJob(leadId: string, teamId: string, region: Region = Region.GLOBAL, campaignId?: string, extraction?: any) {
        const targetPrisma = DbFactory.getClient(region);
        const lead = await targetPrisma.lead.findUnique({ where: { id: leadId } });
        if (!lead) return;

        const effectiveExtraction = extraction || await this.enrichLeadData({
            Name: lead.fullName || "",
            Email: lead.email || "",
            Company: lead.company || "",
            Industry: (lead as any).tags?.[0] || ""
        });

        if (!lead.isEnriched) {
            await targetPrisma.lead.update({
                where: { id: lead.id },
                data: {
                    isEnriched: true,
                    enrichedData: effectiveExtraction.proprietarySignal as any
                }
            });
        }

        if (campaignId) {
            await this.triggerInitialGeneration(lead, effectiveExtraction.proprietarySignal, teamId, region);
        }
    }

    /**
     * Generates the initial draft using the proprietary signal.
     */
    private async triggerInitialGeneration(lead: Lead, signal: any, teamId: string, region: Region = Region.GLOBAL) {
        const targetPrisma = DbFactory.getClient(region);
        
        const promptPayload = {
            industry: signal.targetIndustry,
            painPoint: signal.topPainPoint,
            angle: signal.winningAngle,
            companyName: lead.company,
            leadName: lead.fullName
        };

        const systemPrompt = `You are an expert sales copywriter.
Target Industry: ${signal.targetIndustry}
Pain Point: ${signal.topPainPoint}
Our Solution Angle: ${signal.winningAngle}

Write a personalized cold email to ${lead.fullName} at ${lead.company}.
Keep it under 100 words. Be professional yet conversational.`;

        let draft = "";
        try {
            draft = await modelGateway.generate({
                prompt: systemPrompt,
                teamId: lead.teamId || teamId,
                maxTokens: 300,
                temperature: 0.7
            });
        } catch (e) {
            console.error("AI Generation Failed during ingestion, using fallback.");
            draft = `Hi ${lead.fullName},\n\nI noticed ${lead.company} might be facing challenges with ${signal.topPainPoint}. We have a solution.\n\nBest,\n[Your Name]`;
        }

        await targetPrisma.generation.create({
            data: {
                leadId: lead.id,
                promptPayload: promptPayload,
                generatedText: draft,
                status: "PENDING", 
                conversionValue: 0.0 
            }
        });

        await EventStore.record({
            type: SystemEventType.AI,
            name: "DRAFT_GENERATED",
            teamId: lead.teamId || teamId,
            payload: {
                leadId: lead.id,
                leadName: lead.fullName,
                draftSnippet: draft.substring(0, 50) + "...",
                region
            }
        });
    }

    /**
     * Step 3: Tracking Behavioral "Beta Runs"
     * Called when user copies text or indicates success.
     */
    async recordFeedback(generationId: string, feedbackType: "COPY" | "THUMBS_UP" | "REPLY") {
        const conversionMap = {
            'COPY': 0.5,       // Weak signal
            'THUMBS_UP': 1.0,  // Strong signal
            'REPLY': 5.0       // Very strong signal
        };

        const conversionValue = conversionMap[feedbackType] || 0.0;

        // Update the Generation
        const generation = await prisma.generation.update({
            where: { id: generationId },
            data: {
                status: feedbackType === 'REPLY' ? 'REPLIED' : 'SENT',
                conversionValue: conversionValue
            },
            include: { lead: true }
        });

        // Step 4: Building the Lead Scoring Engine
        // Update the Lead Score
        if (conversionValue > 0) {
            await prisma.lead.update({
                where: { id: generation.leadId },
                data: {
                    leadScore: { increment: Math.ceil(conversionValue * 10) }, // e.g. +5, +10, +50 points
                    intentScore: { increment: conversionValue * 0.1 } // Small bump in 0-1 score
                }
            });
        }

        // [NEW] Record Feedback Event
        await EventStore.record({
            type: SystemEventType.USER,
            name: "FEEDBACK_RECEIVED",
            teamId: generation.lead.teamId || "",
            payload: {
                generationId: generation.id,
                feedbackType,
                conversionValue
            }
        });
    }
}

export const dataIngestionService = new DataIngestionService();
