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
} from "../schemas";
import { landingAgentService } from "../service";

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
            throw new APIError("Invalid input", 400, "VALIDATION_ERROR");
        }

        const page = await landingAgentService.selectWireframe({
            teamId,
            campaignId,
            wireframeId: parsed.data.wireframeId,
        });
        return successResponse(page);
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
            renderedJson: page.renderedJson,
            campaignId: page.campaignId,
        });
    } catch (error) {
        return handleAPIError(error);
    }
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
            ipAddress,
            userAgent,
        });

        return successResponse({ ok: true, eventId: event.id }, 201);
    } catch (error) {
        return handleAPIError(error);
    }
}
