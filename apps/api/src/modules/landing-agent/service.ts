import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";
import { EventStore, SystemEventType } from "@/modules/learning/EventStore";
import { audit } from "@/lib/governance/audit";
import { enforcePolicy } from "@/lib/governance/guard";
import { buildBriefPrompt, buildWireframePrompt } from "./prompts";
import type { LandingBrief, LandingPageSection, WireframeOption } from "./types";
import { LANDING_PAGE_TEMPLATES } from "./templates";
import { landingEventNameEnum } from "./schemas";
import { OutboxService } from "@/lib/outboxService";
import { BlindIndexService } from "@/lib/blindIndexService";
import { ApprovalService } from "@/modules/governance/ApprovalService";

function extractJsonCandidate(raw: string): string {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        return trimmed;
    }

    const firstBrace = trimmed.indexOf("{");
    const firstBracket = trimmed.indexOf("[");
    const candidates = [firstBrace, firstBracket].filter((idx) => idx >= 0);
    if (candidates.length === 0) {
        return trimmed;
    }

    const start = Math.min(...candidates);
    const endBrace = trimmed.lastIndexOf("}");
    const endBracket = trimmed.lastIndexOf("]");
    const end = Math.max(endBrace, endBracket);
    if (end <= start) {
        return trimmed.slice(start);
    }
    return trimmed.slice(start, end + 1);
}

function clampText(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    return value.slice(0, maxLength);
}

function sanitizeString(value: string): string {
    return value
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
        .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
        .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, "")
        .replace(/<embed[\s\S]*?>[\s\S]*?<\/embed>/gi, "")
        .replace(/\son[a-z]+\s*=\s*["'][^"']*["']/gi, "")
        .replace(/\sstyle\s*=\s*["'][^"']*["']/gi, "")
        .replace(/javascript:/gi, "")
        .trim();
}

function sanitizeJson(value: unknown): unknown {
    if (typeof value === "string") return sanitizeString(value);
    if (Array.isArray(value)) return value.map((item) => sanitizeJson(item));
    if (!value || typeof value !== "object") return value;

    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(input)) {
        if (key === "__proto__" || key === "prototype" || key === "constructor") {
            continue;
        }
        output[key] = sanitizeJson(val);
    }

    return output;
}

function slugify(input: string): string {
    const base = input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
    return base || "landing-page";
}

function fallbackBrief(prompt: string, framework?: string | null): LandingBrief {
    return {
        challenge: clampText(prompt, 180),
        solution: "Provide a clear, practical workflow that reduces manual effort.",
        benefit: "Faster pipeline movement with controlled, measurable execution.",
        framework: framework || "PAS",
        audience: ["B2B growth teams", "Revenue operations leaders"],
        proofPoints: [
            "Works within existing stack and governance controls.",
            "Captures attribution and conversion signals from day one.",
        ],
    };
}

function fallbackWireframes(brief: LandingBrief): WireframeOption[] {
    const common: LandingPageSection[] = [
        { id: "hero", type: "hero", heading: brief.solution, body: brief.benefit, ctaLabel: "Get Started" },
        { id: "challenge_solution", type: "challenge_solution", heading: "The Challenge", body: brief.challenge },
        { id: "pain_points", type: "pain_points", heading: "Pain Points", bullets: brief.audience },
        { id: "benefits", type: "benefits", heading: "Benefits", bullets: brief.proofPoints },
        { id: "proof", type: "proof", heading: "Proof", body: "Customer outcomes and practical implementation signal confidence." },
        { id: "faq", type: "faq", heading: "FAQ", body: "Clear answers to common implementation and timeline questions." },
        { id: "cta_form", type: "cta_form", heading: "Request a Demo", body: "Share your details and we will follow up.", ctaLabel: "Submit" },
        { id: "footer", type: "footer", heading: "Ready to move faster?", ctaLabel: "Talk to Sales" },
    ];

    return [
        {
            title: "Operator-Focused Funnel",
            description: "Direct problem-first flow for implementation-minded buyers.",
            framework: brief.framework,
            sections: common,
        },
        {
            title: "Proof-Led Funnel",
            description: "Leads with evidence and trust before conversion ask.",
            framework: brief.framework,
            sections: [
                common[0]!,
                common[4]!,
                common[1]!,
                common[3]!,
                common[5]!,
                common[6]!,
                common[7]!,
            ],
        },
        {
            title: "Narrative Funnel",
            description: "Story-style progression from pain to measurable upside.",
            framework: brief.framework,
            sections: [
                common[0]!,
                common[1]!,
                common[2]!,
                common[3]!,
                common[4]!,
                common[6]!,
                common[7]!,
            ],
        },
    ];
}

async function generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name);
    for (let i = 0; i < 20; i += 1) {
        const suffix = i === 0 ? "" : `-${Math.random().toString(36).slice(2, 7)}`;
        const candidate = `${base}${suffix}`;
        const exists = await prisma.landingPage.findUnique({ where: { slug: candidate } });
        if (!exists) {
            return candidate;
        }
    }
    return `${base}-${Date.now().toString(36)}`;
}

async function getCampaignOrThrow(campaignId: string, teamId: string) {
    const campaign = await prisma.landingCampaign.findFirst({
        where: { id: campaignId, teamId },
        include: {
            assets: { orderBy: { createdAt: "asc" } },
            wireframeOptions: { orderBy: { createdAt: "asc" } },
            pages: { orderBy: { createdAt: "desc" } },
        },
    });

    if (!campaign) {
        throw new Error("Landing campaign not found");
    }
    return campaign;
}

// Scoped by teamId here too, not just getCampaignOrThrow's pre-check - same
// "scope the mutation, not just a pre-check" anti-pattern already fixed under
// OPEN-99/109/110/118/120/121/122/123/127. A page/campaign id resolved through
// getCampaignOrThrow is already team-owned at call time, so this is
// defense-in-depth, not currently exploitable.
async function updateOwnedPage(id: string, teamId: string, data: Prisma.LandingPageUpdateInput) {
    const result = await prisma.landingPage.updateMany({ where: { id, teamId }, data });
    if (result.count === 0) {
        throw new Error("Landing page not found");
    }
    return prisma.landingPage.findUniqueOrThrow({ where: { id } });
}

async function updateOwnedCampaign(id: string, teamId: string, data: Prisma.LandingCampaignUpdateInput) {
    const result = await prisma.landingCampaign.updateMany({ where: { id, teamId }, data });
    if (result.count === 0) {
        throw new Error("Landing campaign not found");
    }
    return prisma.landingCampaign.findUniqueOrThrow({ where: { id } });
}

export const landingAgentService = {
    async createCampaign(input: {
        teamId: string;
        userId: string;
        name: string;
        prompt: string;
        framework?: string;
        linkedCampaignId?: string | null;
    }) {
        const safePrompt = clampText(input.prompt.trim(), 4000);
        const campaign = await prisma.landingCampaign.create({
            data: {
                teamId: input.teamId,
                ownerId: input.userId,
                linkedCampaignId: input.linkedCampaignId ?? null,
                name: input.name,
                prompt: safePrompt,
                framework: input.framework ?? null,
                status: "draft",
            },
        });

        return campaign;
    },

    async getCampaign(teamId: string, campaignId: string) {
        return getCampaignOrThrow(campaignId, teamId);
    },

    async addAsset(input: {
        teamId: string;
        campaignId: string;
        text?: string;
        sourceName?: string;
        pdfKnowledgeItemId?: string;
    }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        let resolvedText = input.text?.trim() || "";
        let resolvedSource = input.sourceName?.trim() || "direct-text";
        let type = "TEXT";

        if (!resolvedText && input.pdfKnowledgeItemId) {
            const knowledgeItem = await prisma.knowledgeItem.findFirst({
                where: {
                    id: input.pdfKnowledgeItemId,
                    knowledgeBase: { teamId: input.teamId },
                },
                include: {
                    knowledgeBase: true,
                },
            });
            if (!knowledgeItem) {
                throw new Error("Knowledge item not found for this team");
            }
            resolvedText = knowledgeItem.content;
            resolvedSource = (knowledgeItem.metadata as any)?.originalName || knowledgeItem.id;
            type = "PDF";
        }

        if (!resolvedText) {
            throw new Error("Asset text is required");
        }

        const asset = await prisma.landingAsset.create({
            data: {
                campaignId: campaign.id,
                type,
                sourceName: resolvedSource,
                content: clampText(resolvedText, 50000),
            },
        });

        return asset;
    },

    async generateBrief(input: {
        teamId: string;
        campaignId: string;
        framework?: string;
    }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        const assetText = clampText(
            campaign.assets.map((a) => a.content).join("\n\n"),
            7000
        );
        const campaignPrompt = clampText(campaign.prompt, 3000);

        const prompt = buildBriefPrompt({
            campaignName: campaign.name,
            prompt: campaignPrompt,
            framework: input.framework || campaign.framework,
            assetText,
        });

        let brief: LandingBrief = fallbackBrief(campaign.prompt, input.framework || campaign.framework);

        try {
            const raw = await aiService.askAI(prompt, input.teamId, {
                taskType: "LANDING_BRIEF",
                surface: "LANDING",
                expectsJson: true,
                disableGuardrails: true,
            });
            const parsed = JSON.parse(extractJsonCandidate(raw)) as Partial<LandingBrief>;
            brief = {
                challenge: parsed.challenge || brief.challenge,
                solution: parsed.solution || brief.solution,
                benefit: parsed.benefit || brief.benefit,
                framework: parsed.framework || input.framework || campaign.framework || brief.framework,
                audience: Array.isArray(parsed.audience) ? parsed.audience.map((x) => String(x)) : brief.audience,
                proofPoints: Array.isArray(parsed.proofPoints) ? parsed.proofPoints.map((x) => String(x)) : brief.proofPoints,
            };
        } catch {
            // Keep deterministic fallback for unavailable AI or invalid JSON.
        }

        await updateOwnedCampaign(campaign.id, input.teamId, {
            challenge: brief.challenge,
            solution: brief.solution,
            benefit: brief.benefit,
            framework: brief.framework,
        });

        return brief;
    },

    async generateWireframes(input: {
        teamId: string;
        campaignId: string;
    }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        const brief: LandingBrief = {
            challenge: campaign.challenge || clampText(campaign.prompt, 260),
            solution: campaign.solution || "Position the product as the practical path forward.",
            benefit: campaign.benefit || "Improve conversion speed with less manual effort.",
            framework: campaign.framework || "PAS",
            audience: ["B2B operators", "Growth leaders"],
            proofPoints: ["Production-safe rollout", "Clear attribution and signal capture"],
        };

        const prompt = buildWireframePrompt({
            brief,
            campaignName: campaign.name,
        });

        let options = fallbackWireframes(brief);

        try {
            const raw = await aiService.askAI(prompt, input.teamId, {
                taskType: "LANDING_WIREFRAME",
                surface: "LANDING",
                expectsJson: true,
                disableGuardrails: true,
            });
            const parsed = JSON.parse(extractJsonCandidate(raw));
            if (Array.isArray(parsed) && parsed.length >= 3) {
                options = parsed.slice(0, 3).map((entry: any, index: number) => ({
                    title: String(entry.title || `Wireframe ${index + 1}`),
                    description: String(entry.description || "Generated wireframe option"),
                    framework: String(entry.framework || brief.framework),
                    sections: Array.isArray(entry.sections)
                        ? entry.sections.map((section: any, sectionIndex: number) => ({
                            id: String(section.id || `${section.type || "section"}-${sectionIndex + 1}`),
                            type: String(section.type || "hero"),
                            heading: section.heading ? String(section.heading) : undefined,
                            body: section.body ? String(section.body) : undefined,
                            bullets: Array.isArray(section.bullets)
                                ? section.bullets.map((b: unknown) => String(b))
                                : undefined,
                            ctaLabel: section.ctaLabel ? String(section.ctaLabel) : undefined,
                            imagePrompt: section.imagePrompt ? String(section.imagePrompt) : undefined,
                        }))
                        : fallbackWireframes(brief)[index]?.sections || [],
                }));
            }
        } catch {
            // Keep deterministic fallback options.
        }

        const allOptions = [...options, ...LANDING_PAGE_TEMPLATES];

        await prisma.$transaction([
            prisma.landingWireframeOption.deleteMany({ where: { campaignId: campaign.id } }),
            prisma.landingWireframeOption.createMany({
                data: allOptions.map((option, index) => ({
                    campaignId: campaign.id,
                    title: option.title,
                    description: option.description,
                    framework: option.framework,
                    score: allOptions.length - index,
                    structure: sanitizeJson(option.sections) as Prisma.InputJsonValue,
                })),
            }),
        ]);

        return prisma.landingWireframeOption.findMany({
            where: { campaignId: campaign.id },
            orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        });
    },

    async selectWireframe(input: {
        teamId: string;
        campaignId: string;
        wireframeId: string;
    }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        const wireframe = campaign.wireframeOptions.find((item) => item.id === input.wireframeId);
        if (!wireframe) {
            throw new Error("Wireframe option not found");
        }

        const existingPage = campaign.pages[0];
        if (existingPage) {
            const updatedPage = await updateOwnedPage(existingPage.id, input.teamId, {
                renderedJson: sanitizeJson(wireframe.structure) as Prisma.InputJsonValue,
                version: { increment: 1 },
                status: existingPage.status === "published" ? "draft" : existingPage.status,
            });
            await updateOwnedCampaign(campaign.id, input.teamId, {
                selectedWireframeId: wireframe.id,
                status: "draft",
            });
            return updatedPage;
        }

        const slug = await generateUniqueSlug(campaign.name);
        const createdPage = await prisma.landingPage.create({
            data: {
                campaignId: campaign.id,
                teamId: campaign.teamId,
                slug,
                title: `${campaign.name} Landing Page`,
                status: "draft",
                version: 1,
                renderedJson: sanitizeJson(wireframe.structure) as Prisma.InputJsonValue,
            },
        });

        await updateOwnedCampaign(campaign.id, input.teamId, {
            selectedWireframeId: wireframe.id,
            status: "draft",
        });

        return createdPage;
    },

    async generateImagesForPage(input: {
        teamId: string;
        campaignId: string;
        pageId: string;
    }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        const page = campaign.pages.find((p) => p.id === input.pageId);
        if (!page) {
            throw new Error("Landing page not found");
        }

        const renderedJson = page.renderedJson;
        const isPlainArray = Array.isArray(renderedJson);
        const data = !isPlainArray && renderedJson && typeof renderedJson === "object" ? (renderedJson as Record<string, unknown>) : null;
        const sections: LandingPageSection[] | null = isPlainArray
            ? (renderedJson as unknown as LandingPageSection[])
            : data && Array.isArray(data["sections"])
                ? (data["sections"] as unknown as LandingPageSection[])
                : null;
        if (!sections) {
            throw new Error("Landing page does not have generatable sections (already flattened to HTML by an editor save)");
        }

        const { imageGenerationService } = await import("./service/imageGenerationService");

        let changed = false;
        for (const section of sections) {
            if (!section.imagePrompt || section.imageUrl) continue;
            const key = `${page.id}-${section.id}.png`;
            const result = await imageGenerationService.generateSectionImage(section.imagePrompt, input.teamId, key);
            if (result.status === "generated" && result.url) {
                section.imageUrl = result.url;
                changed = true;
            }
        }

        if (!changed) {
            return page;
        }

        const updatedRenderedJson = isPlainArray ? sections : { ...(data as Record<string, unknown>), sections };

        return updateOwnedPage(page.id, input.teamId, {
            renderedJson: sanitizeJson(updatedRenderedJson) as Prisma.InputJsonValue,
            version: { increment: 1 },
            status: page.status === "published" ? "draft" : page.status,
        });
    },

    async saveEditorState(input: {
        teamId: string;
        campaignId: string;
        title?: string;
        editorState?: unknown;
        renderedJson: unknown;
    }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        const page = campaign.pages[0];
        if (!page) {
            throw new Error("Landing page not initialized. Select a wireframe first.");
        }

        const sanitizedEditorState = sanitizeJson(input.editorState);
        const sanitizedRendered = sanitizeJson(input.renderedJson);

        return updateOwnedPage(page.id, input.teamId, {
            title: input.title ?? page.title,
            editorState: sanitizedEditorState as Prisma.InputJsonValue | undefined,
            renderedJson: sanitizedRendered as Prisma.InputJsonValue,
            version: { increment: 1 },
            status: page.status === "published" ? "draft" : page.status,
        });
    },

    async publishCampaign(input: {
        teamId: string;
        userId: string;
        campaignId: string;
        requireApproval: boolean;
    }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        const page = campaign.pages[0];
        if (!page) {
            throw new Error("No landing page found for campaign");
        }

        if (input.requireApproval) {
            try {
                await enforcePolicy({
                    orgId: input.teamId,
                    userId: input.userId,
                    action: "PUBLISH_PUBLIC_PLAYBOOK",
                    payload: { landingCampaignId: campaign.id, landingPageId: page.id },
                });
            } catch (error: any) {
                if (error?.message === "APPROVAL_REQUIRED") {
                    const request = await ApprovalService.requestEntityApproval(
                        "LandingPage",
                        page.id,
                        input.teamId,
                        "LANDING_PAGE_PUBLISH",
                        { landingCampaignId: campaign.id, landingPageId: page.id },
                        input.userId
                    );
                    return {
                        status: "PENDING_APPROVAL" as const,
                        requestId: request.id,
                    };
                }
                if (error?.message !== "ORG_POLICY_MISSING") {
                    throw error;
                }
            }
        }

        const updates = await prisma.$transaction(async (tx) => {
            const activeSlug = page.slug || (await generateUniqueSlug(campaign.name));
            const pageResult = await tx.landingPage.updateMany({
                where: { id: page.id, teamId: input.teamId },
                data: {
                    slug: activeSlug,
                    status: "published",
                    publishedAt: new Date(),
                },
            });
            if (pageResult.count === 0) {
                throw new Error("Landing page not found");
            }
            const campaignResult = await tx.landingCampaign.updateMany({
                where: { id: campaign.id, teamId: input.teamId },
                data: { status: "published" },
            });
            if (campaignResult.count === 0) {
                throw new Error("Landing campaign not found");
            }
            const updatedPage = await tx.landingPage.findUniqueOrThrow({ where: { id: page.id } });
            const updatedCampaign = await tx.landingCampaign.findUniqueOrThrow({ where: { id: campaign.id } });
            return { updatedPage, updatedCampaign };
        });

        await audit({
            actorId: input.userId,
            orgId: input.teamId,
            action: "LANDING_PAGE_PUBLISHED",
            entity: "LandingPage",
            entityId: updates.updatedPage.id,
            metadata: {
                landingCampaignId: campaign.id,
                slug: updates.updatedPage.slug,
            },
        });

        const { cloudflarePagesService } = await import("./service/cloudflarePagesService");
        const cloudflareResult = await cloudflarePagesService.publishPageToCloudflare(updates.updatedPage.id);
        if (cloudflareResult.status === "error") {
            console.error(`[landingAgentService] Cloudflare push failed for page ${updates.updatedPage.id}: ${cloudflareResult.details}`);
        }

        return {
            status: "PUBLISHED" as const,
            page: updates.updatedPage,
            campaign: updates.updatedCampaign,
        };
    },

    async getPublicPageBySlug(slug: string) {
        return prisma.landingPage.findFirst({
            where: {
                slug,
                status: "published",
            },
            include: {
                campaign: true,
            },
        });
    },

    async submitLeadBySlug(input: {
        slug: string;
        payload: {
            sessionId?: string;
            pageVersion?: number;
            name?: string;
            email?: string;
            phone?: string;
            company?: string;
            title?: string;
            rawPayload?: unknown;
            utmSource?: string;
            utmMedium?: string;
            utmCampaign?: string;
            utmTerm?: string;
            utmContent?: string;
            referrer?: string;
        };
        ipAddress?: string;
        userAgent?: string;
    }) {
        const page = await this.getPublicPageBySlug(input.slug);
        if (!page) {
            throw new Error("Published landing page not found");
        }

        const lead = await prisma.$transaction(async (tx) => {
            const createdLead = await tx.landingLead.create({
                data: {
                    landingPageId: page.id,
                    campaignId: page.campaignId,
                    teamId: page.teamId,
                    sessionId: input.payload.sessionId,
                    pageVersion: input.payload.pageVersion ?? page.version,
                    name: input.payload.name,
                    email: input.payload.email,
                    phone: input.payload.phone,
                    company: input.payload.company,
                    title: input.payload.title,
                    rawPayload: sanitizeJson(input.payload.rawPayload) as Prisma.InputJsonValue | undefined,
                    utmSource: input.payload.utmSource,
                    utmMedium: input.payload.utmMedium,
                    utmCampaign: input.payload.utmCampaign,
                    utmTerm: input.payload.utmTerm,
                    utmContent: input.payload.utmContent,
                    referrer: input.payload.referrer,
                    ipAddress: input.ipAddress,
                    userAgent: input.userAgent,
                },
            });

            if (input.payload.email) {
                await BlindIndexService.createBlindIndex(
                    {
                        teamId: page.teamId,
                        entityType: "LandingLead",
                        entityId: createdLead.id,
                        fieldName: "email",
                        plaintext: input.payload.email,
                    },
                    tx
                );
            }

            if (input.payload.phone) {
                await BlindIndexService.createBlindIndex(
                    {
                        teamId: page.teamId,
                        entityType: "LandingLead",
                        entityId: createdLead.id,
                        fieldName: "phone",
                        plaintext: input.payload.phone,
                    },
                    tx
                );
            }

            await OutboxService.publishEvent(
                {
                    teamId: page.teamId,
                    eventType: "LANDING_LEAD_CREATED",
                    aggregateType: "LandingLead",
                    aggregateId: createdLead.id,
                    payload: {
                        slug: page.slug,
                        landingPageId: page.id,
                        campaignId: page.campaignId,
                        email: input.payload.email,
                        name: input.payload.name,
                    },
                    idempotencyKey: `landing_lead_${createdLead.id}`,
                },
                tx
            );

            await tx.landingEvent.create({
                data: {
                    landingPageId: page.id,
                    campaignId: page.campaignId,
                    teamId: page.teamId,
                    sessionId: input.payload.sessionId,
                    pageVersion: input.payload.pageVersion ?? page.version,
                    eventName: "form_submit",
                    eventData: {
                        leadId: createdLead.id,
                    },
                    ipAddress: input.ipAddress,
                    userAgent: input.userAgent,
                },
            });

            return createdLead;
        });

        try {
            await EventStore.record({
                type: SystemEventType.USER,
                name: "LANDING_FORM_SUBMIT",
                teamId: page.teamId,
                actorId: "PUBLIC",
                payload: {
                    slug: page.slug,
                    landingPageId: page.id,
                    landingCampaignId: page.campaignId,
                    leadId: lead.id,
                },
            });
        } catch {
            // Analytics event persistence is best effort.
        }

        return {
            lead,
            page,
        };
    },

    async trackEventBySlug(input: {
        slug: string;
        eventName: string;
        sessionId?: string;
        pageVersion?: number;
        eventData?: unknown;
        ipAddress?: string;
        userAgent?: string;
    }) {
        if (!landingEventNameEnum.safeParse(input.eventName).success) {
            throw new Error("Invalid event name");
        }

        const page = await this.getPublicPageBySlug(input.slug);
        if (!page) {
            throw new Error("Published landing page not found");
        }

        const event = await prisma.landingEvent.create({
            data: {
                landingPageId: page.id,
                campaignId: page.campaignId,
                teamId: page.teamId,
                sessionId: input.sessionId,
                pageVersion: input.pageVersion ?? page.version,
                eventName: input.eventName,
                eventData: sanitizeJson(input.eventData) as Prisma.InputJsonValue | undefined,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
            },
        });

        try {
            await EventStore.record({
                type: SystemEventType.USER,
                name: `LANDING_${input.eventName.toUpperCase()}`,
                teamId: page.teamId,
                actorId: "PUBLIC",
                payload: {
                    slug: page.slug,
                    landingPageId: page.id,
                    landingCampaignId: page.campaignId,
                    landingEventId: event.id,
                },
            });
        } catch {
            // Best effort for audit trail enrichment.
        }

        return event;
    },
};
