import { NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { APIError, handleAPIError, successResponse } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import {
    addLandingAssetSchema,
    createLandingCampaignSchema,
    editorStateSchema,
    generateBriefSchema,
    landingEventPayloadSchema,
    landingLeadPayloadSchema,
    publishCampaignSchema,
    selectWireframeSchema,
    setPageSlugSchema,
    createExperimentSchema,
    pickWinnerSchema,
} from "../schemas";
import { createExperiment, endExperiment, getExperimentResults, listExperiments, pauseExperiment, pickWinner, startExperiment } from "../experimentService";
import { pageTrackingSchema } from "../tracking";
import { landingAgentService } from "../service";
import { isLandingImageStorageConfigured, putLandingImage } from "../service/imageGenerationService";
import { MAX_LANDING_IMAGE_BYTES, checkLandingImageUpload } from "../imageUpload";
import { checkApiRateLimit, rateLimitResponse } from "@/lib/apiRateLimit";
import { sanitizeRenderedJsonHtml } from "../rendering";
import { whatsappOptInText } from "@/modules/creator-funnel/whatsappOptIn";

type ParamContext = { params?: Promise<Record<string, string>> };

async function resolveParam(
    req: Request,
    ctx: ParamContext | undefined,
    key: string,
    pathAnchor?: string,
) {
    const fromCtx = await ctx?.params;
    const direct = fromCtx?.[key];
    if (direct) {
        return direct;
    }

    if (!pathAnchor) {
        return undefined;
    }

    const pathname = new URL(req.url).pathname;
    const parts = pathname.split("/").filter(Boolean);
    const anchorIndex = parts.findIndex((p) => p === pathAnchor);
    if (anchorIndex === -1) {
        return undefined;
    }
    return parts[anchorIndex + 1];
}

function getClientMeta(req: Request) {
    const ipAddress =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        undefined;
    const userAgent = req.headers.get("user-agent") || undefined;
    return { ipAddress, userAgent };
}

async function requireTeamContext(req: Request, minRole: TeamRole) {
    const ctx = await getCurrentContextFromRequest(req);
    if (!ctx.userId || !ctx.teamId) {
        throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }
    await authorizeRole(ctx.userId, ctx.teamId, minRole);
    return ctx;
}

export async function postCampaigns(req: Request) {
    try {
        const { teamId, userId } = await requireTeamContext(req, TeamRole.MEMBER);
        const body = await req.json();
        const parsed = createLandingCampaignSchema.safeParse(body);
        if (!parsed.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }
        const campaign = await landingAgentService.createCampaign({
            teamId,
            userId,
            ...parsed.data,
        });
        return successResponse(campaign, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function getCampaigns(req: Request) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.VIEWER);
        const [campaigns, domains] = await Promise.all([
            landingAgentService.listCampaigns(teamId),
            landingAgentService.getActiveDomains(teamId),
        ]);
        // liveDomain is still the oldest active domain, for callers that read only one.
        return successResponse({ campaigns, liveDomain: domains[0] ?? null, domains });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function getCampaignById(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.VIEWER);
        const campaignId = await resolveParam(req, ctx, "id", "campaigns");
        if (!campaignId) {
            throw new APIError("Campaign ID is required", 400, "VALIDATION_ERROR");
        }
        const campaign = await landingAgentService.getCampaign(teamId, campaignId);
        return successResponse(campaign);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function postCampaignAssets(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const campaignId = await resolveParam(req, ctx, "id", "campaigns");
        if (!campaignId) {
            throw new APIError("Campaign ID is required", 400, "VALIDATION_ERROR");
        }
        const body = await req.json();
        const parsed = addLandingAssetSchema.safeParse(body);
        if (!parsed.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }
        const asset = await landingAgentService.addAsset({
            teamId,
            campaignId,
            ...parsed.data,
        });
        return successResponse(asset, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function postCampaignBrief(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const campaignId = await resolveParam(req, ctx, "id", "campaigns");
        if (!campaignId) {
            throw new APIError("Campaign ID is required", 400, "VALIDATION_ERROR");
        }

        const body = await req.json().catch(() => ({}));
        const parsed = generateBriefSchema.safeParse(body);
        if (!parsed.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        const brief = await landingAgentService.generateBrief({
            teamId,
            campaignId,
            framework: parsed.data.framework,
        });
        return successResponse(brief);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function postCampaignWireframes(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const campaignId = await resolveParam(req, ctx, "id", "campaigns");
        if (!campaignId) {
            throw new APIError("Campaign ID is required", 400, "VALIDATION_ERROR");
        }
        const wireframes = await landingAgentService.generateWireframes({
            teamId,
            campaignId,
        });
        return successResponse(wireframes);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function postSelectWireframe(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const campaignId = await resolveParam(req, ctx, "id", "campaigns");
        if (!campaignId) {
            throw new APIError("Campaign ID is required", 400, "VALIDATION_ERROR");
        }

        const body = await req.json();
        const parsed = selectWireframeSchema.safeParse(body);
        if (!parsed.success) {
            const pathIssue = parsed.error.issues.find((issue) => issue.path[0] === "path");
            throw new APIError(pathIssue?.message ?? "Invalid input", 400, "VALIDATION_ERROR");
        }

        const page = await landingAgentService.selectWireframe({
            teamId,
            campaignId,
            wireframeId: parsed.data.wireframeId,
            path: parsed.data.path,
        });
        return successResponse(page);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function postGenerateImages(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const campaignId = await resolveParam(req, ctx, "id", "campaigns");
        const pageId = await resolveParam(req, ctx, "pageId", "pages");
        if (!campaignId || !pageId) {
            throw new APIError("Campaign ID and page ID are required", 400, "VALIDATION_ERROR");
        }

        const page = await landingAgentService.generateImagesForPage({
            teamId,
            campaignId,
            pageId,
        });
        return successResponse(page);
    } catch (error) {
        return handleAPIError(error);
    }
}

// Uploads one image from the editor (multipart field "file") to the public landing-images
// bucket under <teamId>/<uuid>.<ext>. The type comes from the file's bytes; the name and
// Content-Type sent by the browser are ignored. The server never fetches a URL.
export async function postLandingImage(req: Request) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);

        const limit = await checkApiRateLimit(`landing-image-upload:${teamId}`);
        if (!limit.success) {
            return rateLimitResponse(limit.resetIn ?? 60);
        }

        // Reject oversize bodies before parsing them; the multipart envelope adds a little overhead.
        const declaredBytes = Number(req.headers.get("content-length") ?? 0);
        if (declaredBytes > MAX_LANDING_IMAGE_BYTES + 64 * 1024) {
            throw new APIError("The image must be 2MB or smaller", 413, "PAYLOAD_TOO_LARGE");
        }

        if (!isLandingImageStorageConfigured()) {
            throw new APIError("Image storage is not configured", 503, "SERVICE_UNAVAILABLE");
        }

        const form = await req.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
            throw new APIError("An image file is required", 400, "VALIDATION_ERROR");
        }
        if (file.size > MAX_LANDING_IMAGE_BYTES) {
            throw new APIError("The image must be 2MB or smaller", 413, "PAYLOAD_TOO_LARGE");
        }

        const bytes = new Uint8Array(await file.arrayBuffer());
        const check = checkLandingImageUpload(bytes);
        if (!check.ok) {
            throw new APIError(check.error, check.status, "INVALID_IMAGE");
        }

        const objectPath = `${teamId}/${crypto.randomUUID()}.${check.format.extension}`;
        const url = await putLandingImage(objectPath, bytes, check.format.contentType);
        return successResponse({ url }, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function putEditorState(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const campaignId = await resolveParam(req, ctx, "id", "campaigns");
        if (!campaignId) {
            throw new APIError("Campaign ID is required", 400, "VALIDATION_ERROR");
        }
        const body = await req.json();
        const parsed = editorStateSchema.safeParse(body);
        if (!parsed.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        const page = await landingAgentService.saveEditorState({
            teamId,
            campaignId,
            title: parsed.data.title,
            editorState: parsed.data.editorState,
            renderedJson: parsed.data.renderedJson,
        });
        return successResponse(page);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function putPageTracking(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const campaignId = await resolveParam(req, ctx, "id", "campaigns");
        const pageId = await resolveParam(req, ctx, "pageId", "pages");
        if (!campaignId || !pageId) {
            throw new APIError("Campaign ID and page ID are required", 400, "VALIDATION_ERROR");
        }
        const body = await req.json().catch(() => null);
        const parsed = pageTrackingSchema.safeParse(body);
        if (!parsed.success) {
            throw new APIError("Use a GA4 ID like G-XXXXXXX, a Tag Manager ID like GTM-XXXXXX and a numeric Hotjar site ID", 400, "VALIDATION_ERROR");
        }

        const result = await landingAgentService.savePageTracking({
            teamId,
            campaignId,
            pageId,
            tracking: parsed.data,
        });
        return successResponse(result);
    } catch (error) {
        return handleAPIError(error);
    }
}

// PATCH .../pages/:pageId/slug: change a page's path name until it is first published.
export async function patchPageSlug(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const campaignId = await resolveParam(req, ctx, "id", "campaigns");
        const pageId = await resolveParam(req, ctx, "pageId", "pages");
        if (!campaignId || !pageId) {
            throw new APIError("Campaign ID and page ID are required", 400, "VALIDATION_ERROR");
        }
        const parsed = setPageSlugSchema.safeParse(await req.json());
        if (!parsed.success) {
            throw new APIError("Use 2 to 63 letters, numbers or hyphens, starting with a letter or number.", 400, "VALIDATION_ERROR");
        }
        const page = await landingAgentService.setPageSlug({ teamId, campaignId, pageId, path: parsed.data.path });
        return successResponse(page);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function postDiscardDraft(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const campaignId = await resolveParam(req, ctx, "id", "campaigns");
        const pageId = await resolveParam(req, ctx, "pageId", "pages");
        if (!campaignId || !pageId) {
            throw new APIError("Campaign ID and page ID are required", 400, "VALIDATION_ERROR");
        }
        const page = await landingAgentService.discardPageDraft({ teamId, campaignId, pageId });
        return successResponse(page);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function postPublish(req: Request, ctx?: ParamContext) {
    try {
        const { teamId, userId } = await requireTeamContext(req, TeamRole.MEMBER);
        const campaignId = await resolveParam(req, ctx, "id", "campaigns");
        if (!campaignId) {
            throw new APIError("Campaign ID is required", 400, "VALIDATION_ERROR");
        }

        const body = await req.json().catch(() => ({}));
        const parsed = publishCampaignSchema.safeParse(body);
        if (!parsed.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }
        const result = await landingAgentService.publishCampaign({
            teamId,
            userId,
            campaignId,
            requireApproval: parsed.data.requireApproval,
        });
        return successResponse(result);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function getPublicPage(req: Request, ctx?: ParamContext) {
    try {
        const slug = await resolveParam(req, ctx, "slug", "public");
        if (!slug) {
            throw new APIError("Slug is required", 400, "VALIDATION_ERROR");
        }

        const page = await landingAgentService.getPublicPageBySlug(slug);
        if (!page) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return successResponse({
            id: page.id,
            slug: page.slug,
            title: page.title,
            version: page.version,
            renderedJson: sanitizeRenderedJsonHtml(page.renderedJson),
            campaignId: page.campaignId,
            // Creator funnel pages ask for a WhatsApp opt-in; this is the checkbox text, or null for none.
            whatsappOptIn: page.funnelStage ? whatsappOptInText(page.team.name) : null,
        });
    } catch (error) {
        return handleAPIError(error);
    }
}

// Do Not Track or Global Privacy Control: the visit is recorded without an A/B variant (see service.ts abVariantFor).
function doNotTrackRequested(req: Request): boolean {
    return req.headers.get("dnt") === "1" || req.headers.get("sec-gpc") === "1";
}

export async function postPublicLead(req: Request, ctx?: ParamContext) {
    try {
        const slug = await resolveParam(req, ctx, "slug", "public");
        if (!slug) {
            throw new APIError("Slug is required", 400, "VALIDATION_ERROR");
        }

        const body = await req.json();
        const parsed = landingLeadPayloadSchema.safeParse(body);
        if (!parsed.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        if (parsed.data.website) {
            return successResponse({ ok: true, discarded: true }, 202);
        }

        const { ipAddress, userAgent } = getClientMeta(req);
        const result = await landingAgentService.submitLeadBySlug({
            slug,
            payload: parsed.data,
            ipAddress,
            userAgent,
            doNotTrack: doNotTrackRequested(req),
        });

        return successResponse({
            ok: true,
            leadId: result.lead.id,
            thankYouPath: `/p/${slug}/thank-you`,
        });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function postPublicEvent(req: Request, ctx?: ParamContext) {
    try {
        const slug = await resolveParam(req, ctx, "slug", "public");
        if (!slug) {
            throw new APIError("Slug is required", 400, "VALIDATION_ERROR");
        }
        const body = await req.json();
        const parsed = landingEventPayloadSchema.safeParse(body);
        if (!parsed.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        if (parsed.data.website) {
            return successResponse({ ok: true, discarded: true }, 202);
        }

        const { ipAddress, userAgent } = getClientMeta(req);
        const event = await landingAgentService.trackEventBySlug({
            slug,
            eventName: parsed.data.eventName,
            sessionId: parsed.data.sessionId,
            pageVersion: parsed.data.pageVersion,
            eventData: parsed.data.eventData,
            utmSource: parsed.data.utmSource,
            utmMedium: parsed.data.utmMedium,
            utmCampaign: parsed.data.utmCampaign,
            utmTerm: parsed.data.utmTerm,
            utmContent: parsed.data.utmContent,
            ipAddress,
            userAgent,
            doNotTrack: doNotTrackRequested(req),
        });

        return successResponse({ ok: true, eventId: event.id }, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}

// A/B tests between two landing pages (phase 6B). Team scoping happens in experimentService.
export async function postCreateExperiment(req: Request) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const parsed = createExperimentSchema.safeParse(await req.json().catch(() => ({})));
        if (!parsed.success) {
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }
        const experiment = await createExperiment({ teamId, ...parsed.data });
        return successResponse(experiment);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function getExperiments(req: Request) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        return successResponse(await listExperiments({ teamId }));
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function getExperiment(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const experimentId = await resolveParam(req, ctx, "id", "experiments");
        if (!experimentId) {
            throw new APIError("Experiment ID is required", 400, "VALIDATION_ERROR");
        }
        return successResponse(await getExperimentResults({ teamId, experimentId }));
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function postExperimentAction(req: Request, ctx?: ParamContext) {
    try {
        const { teamId } = await requireTeamContext(req, TeamRole.MEMBER);
        const experimentId = await resolveParam(req, ctx, "id", "experiments");
        const action = await resolveParam(req, ctx, "action");
        if (!experimentId) {
            throw new APIError("Experiment ID is required", 400, "VALIDATION_ERROR");
        }
        if (action === "start") return successResponse(await startExperiment({ teamId, experimentId }));
        if (action === "pause") return successResponse(await pauseExperiment({ teamId, experimentId }));
        if (action === "end") return successResponse(await endExperiment({ teamId, experimentId }));
        if (action === "winner") {
            const parsed = pickWinnerSchema.safeParse(await req.json().catch(() => ({})));
            if (!parsed.success) {
                throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
            }
            return successResponse(await pickWinner({ teamId, experimentId, pageId: parsed.data.pageId }));
        }
        throw new APIError("Not found", 404, "NOT_FOUND");
    } catch (error) {
        return handleAPIError(error);
    }
}
