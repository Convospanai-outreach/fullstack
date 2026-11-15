import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APIError } from "@/lib/apiResponse";
import { aiService } from "@/lib/aiService";
import { EventStore, SystemEventType } from "@/modules/learning/EventStore";
import { audit } from "@/lib/governance/audit";
import { enforcePolicy } from "@/lib/governance/guard";
import { buildBriefPrompt, buildWireframePrompt } from "./prompts";
import type { LandingBrief, LandingPageSection, WireframeOption } from "./types";
import { LANDING_PAGE_TEMPLATES } from "./templates";
import { getLandingTemplate, landingAppOrigin, materializeLandingTemplate } from "./landingTemplates";
import { normalizeTracking } from "./tracking";
import { checkConfirmationSequence, confirmationCopyWarnings, listInstantConfirmationSequences } from "./instantConfirmation";
import type { InstantConfirmation } from "./schemas";
import { runningArmOf, variantForPage } from "./experimentService";
import { isBotUserAgent } from "./landingExperimentAssignment";
import { landingEventNameEnum, landingPagePathSchema } from "./schemas";
import { getLandingRenderPayload } from "./rendering";
import { brandThemeFrom, themeValidationError } from "./theme";
import { hasLeadFormMarker, readLeadFormConfig } from "./leadFormHtml";
import { leadFormMarkerError, mapLeadFormSubmission, type LeadFormColumns } from "./leadFormSubmit";
import { consentAllowsContact, consentMissing, consentRecordFor, withoutConsentRecord, type LeadConsentRecord } from "./leadConsent";
import { OutboxService } from "@/lib/outboxService";
import { BlindIndexService } from "@/lib/blindIndexService";
import { ApprovalService } from "@/modules/governance/ApprovalService";
import { loadActivePropertyDefinitions } from "@/modules/lead-properties/leadCustomFields";
import { pickPropertyAnswers } from "@/modules/lead-properties/leadProperties";

export function extractJsonCandidate(raw: string): string {
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
        const experimentExists = exists ? null : await prisma.landingExperiment.findUnique({ where: { slug: candidate }, select: { id: true } });
        if (!exists && !experimentExists) {
            return candidate;
        }
    }
    return `${base}-${Date.now().toString(36)}`;
}

// Editing a page that is an arm of a running test leaves a note in the audit log; the test's panel shows the last edit.
async function noteArmEdit(teamId: string, userId: string, pageId: string) {
    const arm = await runningArmOf(pageId);
    if (!arm) return;
    await audit({
        actorId: userId,
        orgId: teamId,
        action: "landing_experiment.page_edited",
        entity: "LandingExperiment",
        entityId: arm.experimentId,
        metadata: { pageId, variant: arm.name },
    });
}

// The A/B variant a visit counts toward: none for crawlers and Do Not Track visitors, else the variant the test cookie names.
async function abVariantFor(pageId: string, userAgent: string | undefined, doNotTrack: boolean | undefined, cookieHeader: string | null | undefined): Promise<string | null> {
    if (doNotTrack || isBotUserAgent(userAgent ?? null)) return null;
    return variantForPage(pageId, cookieHeader ?? null);
}

const ADDRESS_TAKEN_MESSAGE = "This web address is taken. Try another.";

// Slugs are globally unique (LandingPage.slug @unique), so a chosen path must not match any page's slug.
// An A/B test path (LandingExperiment.slug) is in the same namespace, so it is checked too, both ways.
async function assertAddressFree(slug: string, exceptPageId?: string) {
    const existing = await prisma.landingPage.findUnique({ where: { slug }, select: { id: true } });
    if (existing && existing.id !== exceptPageId) {
        throw new APIError(ADDRESS_TAKEN_MESSAGE, 409, "CONFLICT");
    }
    if (await prisma.landingExperiment.findUnique({ where: { slug }, select: { id: true } })) {
        throw new APIError(ADDRESS_TAKEN_MESSAGE, 409, "CONFLICT");
    }
}

// Two requests can both pass assertAddressFree for one address; the database's unique slug then rejects the second.
// Answer that the same way as the pre-check.
function rethrowAddressTaken(error: unknown): never {
    const { code, meta } = (error ?? {}) as { code?: unknown; meta?: { target?: unknown } };
    if (code === "P2002" && String(meta?.target ?? "").includes("slug")) {
        throw new APIError(ADDRESS_TAKEN_MESSAGE, 409, "CONFLICT");
    }
    throw error;
}

async function getCampaignOrThrow(campaignId: string, teamId: string) {
    const campaign = await prisma.landingCampaign.findFirst({
        where: { id: campaignId, teamId },
        include: {
            assets: { orderBy: { createdAt: "asc" } },
            wireframeOptions: { orderBy: { createdAt: "asc" } },
            pages: { orderBy: { createdAt: "desc" } },
            icp: true,
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

// Publishing copies an unpublished draft (see saveEditorState) to the live columns. A page without
// a draft publishes exactly as before: no copy and no version bump.
function draftPublishData(page: { draftRenderedJson?: unknown; draftEditorState?: unknown }): Prisma.LandingPageUpdateInput {
    if (page.draftRenderedJson == null) return {};
    return {
        renderedJson: page.draftRenderedJson as Prisma.InputJsonValue,
        ...(page.draftEditorState != null ? { editorState: page.draftEditorState as Prisma.InputJsonValue } : {}),
        version: { increment: 1 },
        draftRenderedJson: Prisma.DbNull,
        draftEditorState: Prisma.DbNull,
    };
}

// The editor reads the unpublished draft when there is one; the live columns stay in the database for the public page.
function withDraftForEditor<T extends { renderedJson: unknown; editorState: unknown; draftRenderedJson: unknown; draftEditorState: unknown }>(
    page: T
) {
    const { draftRenderedJson, draftEditorState, ...live } = page;
    if (draftRenderedJson == null) {
        return { ...live, hasUnpublishedChanges: false };
    }
    return {
        ...live,
        renderedJson: draftRenderedJson,
        editorState: draftEditorState ?? live.editorState,
        hasUnpublishedChanges: true,
    };
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
        icpId: string;
    }) {
        const icp = await prisma.iCP.findFirst({ where: { id: input.icpId, teamId: input.teamId } });
        if (!icp) {
            throw new Error("ICP not found for this team");
        }

        const safePrompt = clampText(input.prompt.trim(), 4000);
        const campaign = await prisma.landingCampaign.create({
            data: {
                teamId: input.teamId,
                ownerId: input.userId,
                linkedCampaignId: input.linkedCampaignId ?? null,
                icpId: input.icpId,
                name: input.name,
                prompt: safePrompt,
                framework: input.framework ?? null,
                status: "draft",
            },
        });

        return campaign;
    },

    // Starts a page from an editor-ready template: no brief, no wireframes and no AI call. The page
    // goes through the same save-time checks as the editor (sanitizer and the lead form marker).
    async createCampaignFromTemplate(input: {
        teamId: string;
        userId: string;
        templateId: string;
        name: string;
        path?: string;
        env?: Record<string, string | undefined>;
    }) {
        const template = getLandingTemplate(input.templateId);
        if (!template) {
            throw new APIError("Template not found", 400, "VALIDATION_ERROR");
        }
        const { html, css } = materializeLandingTemplate(template, landingAppOrigin(input.env ?? process.env));
        // A new page starts with the team's brand colours as its theme (none when the brand has no valid colour).
        const brandTheme = brandThemeFrom((await prisma.team.findUnique({ where: { id: input.teamId }, select: { branding: true } }))?.branding);
        const renderedJson = sanitizeJson({ html, css, ...(brandTheme ? { theme: brandTheme } : {}) }) as Prisma.InputJsonValue;
        const markerError = leadFormMarkerError(renderedJson);
        if (markerError) {
            throw new APIError(markerError, 400, "VALIDATION_ERROR");
        }

        const name = input.name.trim();
        // A chosen path is the page's address; without one the slug is generated from the name, as before.
        if (input.path) {
            await assertAddressFree(input.path);
        }
        const slug = input.path ?? (await generateUniqueSlug(name));
        return prisma.$transaction(async (tx) => {
            // The team's default audience, created on first use. The team can rename or edit it in the
            // ICP Builder. A landing campaign needs an ICP; this keeps the template path free of one.
            const defaultIcp = { name: "Default audience", description: "Created for pages started from a template. Describe your real audience in the ICP Builder." };
            const icp =
                (await tx.iCP.findFirst({ where: { teamId: input.teamId, name: defaultIcp.name, status: "active" }, select: { id: true } })) ??
                (await tx.iCP.create({
                    data: {
                        teamId: input.teamId,
                        name: defaultIcp.name,
                        description: defaultIcp.description,
                        criteria: { description: defaultIcp.description, source: "landing-template-default" },
                        status: "active",
                    },
                    select: { id: true },
                }));
            const campaign = await tx.landingCampaign.create({
                data: {
                    teamId: input.teamId,
                    ownerId: input.userId,
                    icpId: icp.id,
                    name,
                    prompt: template.description,
                    status: "draft",
                },
            });
            const page = await tx.landingPage.create({
                data: {
                    campaignId: campaign.id,
                    teamId: input.teamId,
                    slug,
                    title: name,
                    status: "draft",
                    version: 1,
                    renderedJson,
                },
            });
            return { campaignId: campaign.id, pageId: page.id };
        }).catch(rethrowAddressTaken);
    },

    async getCampaign(teamId: string, campaignId: string) {
        const campaign = await getCampaignOrThrow(campaignId, teamId);
        return { ...campaign, pages: campaign.pages.map(withDraftForEditor) };
    },

    // The team's active connected domains, oldest first. Each one serves every published page of the team.
    async getActiveDomains(teamId: string) {
        const records = await prisma.customDomain.findMany({
            where: { teamId, status: "active" },
            orderBy: { createdAt: "asc" },
            select: { domain: true },
        });
        return records.map((record) => record.domain);
    },

    // The team's connected domain that published pages are live on (oldest active one), if any.
    async getLiveDomain(teamId: string) {
        const record = await prisma.customDomain.findFirst({
            where: { teamId, status: "active" },
            orderBy: { createdAt: "asc" },
            select: { domain: true },
        });
        return record?.domain ?? null;
    },

    // Dashboard list: the team's landing campaigns, latest edit first, with only what the list shows.
    async listCampaigns(teamId: string) {
        const campaigns = await prisma.landingCampaign.findMany({
            where: { teamId },
            orderBy: { updatedAt: "desc" },
            take: 200,
            select: {
                id: true,
                name: true,
                updatedAt: true,
                pages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { id: true, slug: true, title: true, status: true, updatedAt: true, draftRenderedJson: true },
                },
                _count: { select: { wireframeOptions: true, leads: true } },
            },
        });
        // One grouped count for every page on the list (not one query per page), scoped to the team.
        const pageIds = campaigns.flatMap((campaign) => campaign.pages.map((page) => page.id));
        const triggerRows = pageIds.length
            ? await prisma.keywordTrigger.groupBy({
                  by: ["landingPageId", "active"],
                  where: { teamId, landingPageId: { in: pageIds } },
                  _count: { _all: true },
              })
            : [];
        const autoRepliesByPage = new Map<string, { total: number; active: number }>();
        for (const row of triggerRows) {
            if (!row.landingPageId) continue;
            const entry = autoRepliesByPage.get(row.landingPageId) ?? { total: 0, active: 0 };
            entry.total += row._count._all;
            if (row.active) entry.active += row._count._all;
            autoRepliesByPage.set(row.landingPageId, entry);
        }
        return campaigns.map((campaign) => ({
            ...campaign,
            pages: campaign.pages.map(({ draftRenderedJson, ...page }) => ({
                ...page,
                hasUnpublishedChanges: draftRenderedJson != null,
                autoReplies: autoRepliesByPage.get(page.id) ?? { total: 0, active: 0 },
            })),
        }));
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
            icp: campaign.icp?.criteria as Record<string, unknown> | undefined,
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
        path?: string;
    }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        const wireframe = campaign.wireframeOptions.find((item) => item.id === input.wireframeId);
        if (!wireframe) {
            throw new Error("Wireframe option not found");
        }

        const existingPage = campaign.pages[0];
        if (existingPage) {
            // A live page keeps serving; the new wireframe waits in the draft columns until publish.
            const updatedPage = await updateOwnedPage(
                existingPage.id,
                input.teamId,
                existingPage.status === "published"
                    ? { draftRenderedJson: sanitizeJson(wireframe.structure) as Prisma.InputJsonValue }
                    : {
                          renderedJson: sanitizeJson(wireframe.structure) as Prisma.InputJsonValue,
                          version: { increment: 1 },
                          status: existingPage.status,
                      }
            );
            await updateOwnedCampaign(campaign.id, input.teamId, {
                selectedWireframeId: wireframe.id,
                status: "draft",
            });
            return updatedPage;
        }

        // A chosen path is the page's address; without one the slug is generated from the campaign name, as before.
        if (input.path) {
            await assertAddressFree(input.path);
        }
        const slug = input.path ?? (await generateUniqueSlug(campaign.name));
        const createdPage = await prisma.landingPage
            .create({
                data: {
                    campaignId: campaign.id,
                    teamId: campaign.teamId,
                    slug,
                    title: `${campaign.name} Landing Page`,
                    status: "draft",
                    version: 1,
                    renderedJson: sanitizeJson(wireframe.structure) as Prisma.InputJsonValue,
                },
            })
            .catch(rethrowAddressTaken);

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

        // Generate from the unpublished draft when there is one, so the latest edits keep their content.
        const renderedJson = page.draftRenderedJson ?? page.renderedJson;
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
            return page.status === "published" ? withDraftForEditor(page) : page;
        }

        const updatedRenderedJson = sanitizeJson(isPlainArray ? sections : { ...(data as Record<string, unknown>), sections }) as Prisma.InputJsonValue;

        // The editor replaces its canvas with the returned content, so return the draft it is editing.
        if (page.status === "published") {
            return withDraftForEditor(await updateOwnedPage(page.id, input.teamId, { draftRenderedJson: updatedRenderedJson }));
        }
        return updateOwnedPage(page.id, input.teamId, {
            renderedJson: updatedRenderedJson,
            version: { increment: 1 },
            status: page.status,
        });
    },

    async saveEditorState(input: {
        teamId: string;
        userId: string;
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
        const markerError = leadFormMarkerError(input.renderedJson);
        if (markerError) throw new APIError(markerError, 400, "VALIDATION_ERROR");
        const themeError = themeValidationError(input.renderedJson);
        if (themeError) throw new APIError(themeError, 400, "VALIDATION_ERROR");

        // A live page keeps serving its last publish; edits go to the draft columns until publish.
        // The title is page metadata, not content, so it goes live at once (the public title
        // only changes on the next publish that copies the draft).
        const saved =
            page.status === "published"
                ? await updateOwnedPage(page.id, input.teamId, {
                      title: input.title ?? page.title,
                      draftRenderedJson: sanitizedRendered as Prisma.InputJsonValue,
                      draftEditorState: sanitizedEditorState as Prisma.InputJsonValue | undefined,
                  })
                : await updateOwnedPage(page.id, input.teamId, {
                      title: input.title ?? page.title,
                      editorState: sanitizedEditorState as Prisma.InputJsonValue | undefined,
                      renderedJson: sanitizedRendered as Prisma.InputJsonValue,
                      version: { increment: 1 },
                      status: page.status,
                  });
        await noteArmEdit(input.teamId, input.userId, page.id);
        return saved;
    },

    // A page's path name can change until the page is first published; after that the address is fixed.
    async setPageSlug(input: { teamId: string; campaignId: string; pageId: string; path: string }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        const page = campaign.pages.find((p) => p.id === input.pageId);
        if (!page) {
            throw new Error("Landing page not found");
        }
        const path = input.path.trim().toLowerCase();
        if (page.slug === path) {
            return page;
        }
        const checked = landingPagePathSchema.safeParse(path);
        if (!checked.success) {
            throw new APIError(checked.error.issues[0]?.message ?? "Use 2 to 63 letters, numbers or hyphens, starting with a letter or number.", 400, "VALIDATION_ERROR");
        }
        if (page.publishedAt || page.status === "published") {
            throw new APIError("The web address can only change before the page is first published.", 409, "CONFLICT");
        }
        await assertAddressFree(path, page.id);
        return updateOwnedPage(page.id, input.teamId, { slug: path }).catch(rethrowAddressTaken);
    },

    // Throws away unpublished edits; the live page is unchanged and not pushed again.
    async discardPageDraft(input: { teamId: string; campaignId: string; pageId: string }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        const page = campaign.pages.find((p) => p.id === input.pageId);
        if (!page) {
            throw new Error("Landing page not found");
        }
        return updateOwnedPage(page.id, input.teamId, {
            draftRenderedJson: Prisma.DbNull,
            draftEditorState: Prisma.DbNull,
        });
    },

    // Saving tracking IDs leaves the page's status alone; a published page's
    // live copy is re-pushed so the change shows on the connected domain.
    async savePageTracking(input: {
        teamId: string;
        campaignId: string;
        pageId: string;
        tracking: unknown;
    }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        const page = campaign.pages.find((p) => p.id === input.pageId);
        if (!page) {
            throw new Error("Landing page not found");
        }

        const tracking = normalizeTracking(input.tracking);
        const updatedPage = await updateOwnedPage(page.id, input.teamId, {
            tracking: tracking ? (tracking as Prisma.InputJsonValue) : Prisma.DbNull,
        });

        let cloudflare: { status: string; details?: string } | null = null;
        if (updatedPage.status === "published") {
            const { cloudflarePagesService } = await import("./service/cloudflarePagesService");
            cloudflare = await cloudflarePagesService.publishPageToCloudflare(updatedPage.id);
        }
        return { page: updatedPage, cloudflare };
    },

    // Phase 9: the sequences a page's confirmation can use (team scoped).
    async listInstantConfirmationSequences(teamId: string) {
        return listInstantConfirmationSequences(teamId);
    },

    // Phase 9: the page's optional confirmation message. Only a sequence that passes the save-time check can be switched on.
    async savePageInstantConfirmation(input: { teamId: string; campaignId: string; pageId: string; setting: InstantConfirmation }) {
        const campaign = await getCampaignOrThrow(input.campaignId, input.teamId);
        const page = campaign.pages.find((p) => p.id === input.pageId);
        if (!page) {
            throw new Error("Landing page not found");
        }
        if (input.setting.enabled) {
            const check = await checkConfirmationSequence(input.teamId, input.setting.sequenceId);
            if (!check.ok) {
                throw new APIError(check.message, 400, "VALIDATION_ERROR");
            }
        }
        const saved = await updateOwnedPage(page.id, input.teamId, { instantConfirmation: input.setting as Prisma.InputJsonValue });
        // After the save, so Jev can only add a warning, never block it.
        const warnings = await confirmationCopyWarnings(input.teamId, input.setting);
        return { ...saved, warnings };
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
            // Read the draft inside the transaction so the copy below is the latest saved draft.
            const current = await tx.landingPage.findUniqueOrThrow({ where: { id: page.id } });
            const pageResult = await tx.landingPage.updateMany({
                where: {
                    id: page.id,
                    teamId: input.teamId,
                    // A copy is only valid against the draft it read; a save since then makes it stale.
                    ...(current.draftRenderedJson == null ? {} : { updatedAt: current.updatedAt }),
                },
                data: {
                    slug: activeSlug,
                    status: "published",
                    publishedAt: new Date(),
                    ...draftPublishData(current),
                },
            });
            if (pageResult.count === 0) {
                if (current.draftRenderedJson != null) {
                    throw new APIError("The page was edited while publishing. Check your changes and publish again.", 409, "CONFLICT");
                }
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

        // Surface the edge-push outcome so the caller/UI doesn't report an
        // unqualified success when the page never reached Cloudflare (skipped =
        // env not configured, error = KV write failed). Only the status enum is
        // returned to the client - `details` can carry Cloudflare's raw response
        // body, which stays server-side in the console.error above (OPEN-21).
        return {
            status: "PUBLISHED" as const,
            page: updates.updatedPage,
            campaign: updates.updatedCampaign,
            cloudflare: { status: cloudflareResult.status },
            // Connected domains are served from the Cloudflare copy, so only point at one once that push landed.
            liveDomain: cloudflareResult.status === "pushed" ? await this.getLiveDomain(input.teamId) : null,
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
                team: { select: { name: true } },
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
            socialToken?: string;
            whatsappConsent?: boolean;
            // The lead form's consent box (cmfConsent). Checked against the page's form config below.
            consent?: boolean;
            formFields?: Record<string, unknown>;
            metaEventId?: string;
            metaEventSourceUrl?: string;
        };
        ipAddress?: string;
        userAgent?: string;
        doNotTrack?: boolean;
        cookieHeader?: string | null;
        metaCookies?: { fbc?: string; fbp?: string };
    }) {
        const page = await this.getPublicPageBySlug(input.slug);
        if (!page) {
            throw new APIError("Published landing page not found", 404, "NOT_FOUND");
        }

        // Pages with a lead form marker take their fields from the page's saved form config.
        // Other pages keep the fixed follow-up box fields.
        let columns: LeadFormColumns = {
            name: input.payload.name,
            email: input.payload.email,
            phone: input.payload.phone,
            company: input.payload.company,
            title: input.payload.title,
        };
        let rawPayload: unknown = withoutConsentRecord(input.payload.rawPayload);
        let consentRecord: LeadConsentRecord | null = null;
        const pageHtml = getLandingRenderPayload(page.renderedJson).html;
        if (hasLeadFormMarker(pageHtml)) {
            const config = readLeadFormConfig(pageHtml);
            const mapped = config ? mapLeadFormSubmission(config, input.payload.formFields) : { ok: false as const, message: "This form is not available" };
            if (!mapped.ok) throw new APIError(mapped.message, 400, "VALIDATION_ERROR");
            if (config && consentMissing(config, input.payload.consent)) {
                throw new APIError("Please tick the consent box to send your details.", 400, "VALIDATION_ERROR");
            }
            columns = mapped.columns;
            rawPayload = mapped.rawPayload;
            // An answer whose key matches a custom property must fit that property's type, or the submit is refused.
            if (mapped.rawPayload) {
                const answers = (mapped.rawPayload as { answers: Record<string, unknown> }).answers;
                const { errors } = pickPropertyAnswers(await loadActivePropertyDefinitions(page.teamId), answers);
                if (errors.length > 0) throw new APIError(`Check the answer for ${errors[0]!.key}`, 400, "VALIDATION_ERROR");
            }
            // A form with a consent box keeps the answer, with the wording shown, in rawPayload.consent.
            consentRecord = config ? consentRecordFor(config, input.payload.consent, page.slug, new Date()) : null;
            if (consentRecord) rawPayload = { ...(mapped.rawPayload ?? {}), consent: consentRecord };
        }

        const variantId = await abVariantFor(page.id, input.userAgent, input.doNotTrack, input.cookieHeader);
        const lead = await prisma.$transaction(async (tx) => {
            const createdLead = await tx.landingLead.create({
                data: {
                    landingPageId: page.id,
                    campaignId: page.campaignId,
                    teamId: page.teamId,
                    sessionId: input.payload.sessionId,
                    pageVersion: input.payload.pageVersion ?? page.version,
                    name: columns.name,
                    email: columns.email,
                    phone: columns.phone,
                    company: columns.company,
                    title: columns.title,
                    rawPayload: sanitizeJson(rawPayload) as Prisma.InputJsonValue | undefined,
                    utmSource: input.payload.utmSource,
                    utmMedium: input.payload.utmMedium,
                    utmCampaign: input.payload.utmCampaign,
                    utmTerm: input.payload.utmTerm,
                    utmContent: input.payload.utmContent,
                    referrer: input.payload.referrer,
                    socialToken: input.payload.socialToken,
                    variantId,
                    // Only creator funnel pages show the WhatsApp opt-in, and it needs a phone number.
                    ...(input.payload.whatsappConsent === true && page.funnelStage && columns.phone?.trim() ? { whatsappConsent: true } : {}),
                    ipAddress: input.ipAddress,
                    userAgent: input.userAgent,
                },
            });

            if (columns.email) {
                await BlindIndexService.createBlindIndex(
                    {
                        teamId: page.teamId,
                        entityType: "LandingLead",
                        entityId: createdLead.id,
                        fieldName: "email",
                        plaintext: columns.email,
                    },
                    tx
                );
            }

            if (columns.phone) {
                await BlindIndexService.createBlindIndex(
                    {
                        teamId: page.teamId,
                        entityType: "LandingLead",
                        entityId: createdLead.id,
                        fieldName: "phone",
                        plaintext: columns.phone,
                    },
                    tx
                );
            }

            // Meta Conversions API: only when the page has a Pixel, the browser sent the event ID it fired
            // (it skips Do Not Track / GPC visitors), and this request is not DNT/GPC. Personal data is not
            // copied here; the job reads it from the lead.
            const metaTracking = normalizeTracking(page.tracking);
            const metaSourceUrl = input.payload.metaEventSourceUrl;
            // Consent: when the form has a consent box, the Lead event is sent only if the visitor ticked it.
            if (metaTracking?.metaPixelId && input.payload.metaEventId && metaSourceUrl?.startsWith("https://") && !input.doNotTrack && consentAllowsContact(rawPayload)) {
                await OutboxService.publishEvent(
                    {
                        teamId: page.teamId,
                        eventType: "LANDING_META_LEAD_CAPI",
                        aggregateType: "LandingLead",
                        aggregateId: createdLead.id,
                        payload: {
                            pixelId: metaTracking.metaPixelId,
                            eventId: input.payload.metaEventId,
                            eventTime: Math.floor(Date.now() / 1000),
                            eventSourceUrl: metaSourceUrl,
                            fbc: input.metaCookies?.fbc,
                            fbp: input.metaCookies?.fbp,
                            testEventCode: metaTracking.metaTestEventCode,
                        },
                        idempotencyKey: `landing_lead_meta_${createdLead.id}`,
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
                        email: columns.email,
                        name: columns.name,
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
                    variantId,
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
        utmSource?: string;
        utmMedium?: string;
        utmCampaign?: string;
        utmTerm?: string;
        utmContent?: string;
        ipAddress?: string;
        userAgent?: string;
        doNotTrack?: boolean;
        cookieHeader?: string | null;
    }) {
        if (!landingEventNameEnum.safeParse(input.eventName).success) {
            throw new APIError("Invalid event name", 400, "VALIDATION_ERROR");
        }

        const page = await this.getPublicPageBySlug(input.slug);
        if (!page) {
            throw new APIError("Published landing page not found", 404, "NOT_FOUND");
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
                utmSource: input.utmSource,
                utmMedium: input.utmMedium,
                utmCampaign: input.utmCampaign,
                utmTerm: input.utmTerm,
                utmContent: input.utmContent,
                variantId: await abVariantFor(page.id, input.userAgent, input.doNotTrack, input.cookieHeader),
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
