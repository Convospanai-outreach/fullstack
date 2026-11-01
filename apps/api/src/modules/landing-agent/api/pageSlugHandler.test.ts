import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetContext, mockAuthorizeRole, mockSetPageSlug } = vi.hoisted(() => ({
    mockGetContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockSetPageSlug: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetContext }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: mockAuthorizeRole, TeamRole: { VIEWER: "VIEWER", MEMBER: "MEMBER" } }));
vi.mock("../service", () => ({ landingAgentService: { setPageSlug: mockSetPageSlug } }));
vi.mock("../service/imageGenerationService", () => ({ isLandingImageStorageConfigured: vi.fn(), putLandingImage: vi.fn() }));
vi.mock("../rendering", () => ({ sanitizeRenderedJsonHtml: vi.fn() }));
vi.mock("@/lib/apiRateLimit", () => ({ checkApiRateLimit: vi.fn(), rateLimitResponse: vi.fn() }));

import { patchPageSlug } from "./handlers";
import { APIError } from "@/lib/apiResponse";

const PARAMS = { params: Promise.resolve({ id: "campaign-1", pageId: "page-1" }) };

function request(body: unknown): Request {
    return new Request("https://app.example/api/landing-agent/campaigns/campaign-1/pages/page-1/slug", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("PATCH /landing-agent/campaigns/:id/pages/:pageId/slug", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockSetPageSlug.mockResolvedValue({ id: "page-1", slug: "spring-guide" });
    });

    it("requires a signed-in user with a team", async () => {
        mockGetContext.mockResolvedValue({});

        const res = await patchPageSlug(request({ path: "spring-guide" }), PARAMS);

        expect(res.status).toBe(401);
        expect(mockSetPageSlug).not.toHaveBeenCalled();
    });

    it("requires at least member access to the team", async () => {
        mockAuthorizeRole.mockRejectedValue(new APIError("Forbidden", 403, "FORBIDDEN"));

        const res = await patchPageSlug(request({ path: "spring-guide" }), PARAMS);

        expect(res.status).toBe(403);
        expect(mockAuthorizeRole).toHaveBeenCalledWith("user-1", "team-1", "MEMBER");
        expect(mockSetPageSlug).not.toHaveBeenCalled();
    });

    it("refuses a missing path before the service is called", async () => {
        const res = await patchPageSlug(request({}), PARAMS);

        expect(res.status).toBe(400);
        expect(mockSetPageSlug).not.toHaveBeenCalled();
    });

    it("passes a malformed path to the service, which refuses it unless it is the page's current address", async () => {
        mockSetPageSlug.mockRejectedValue(new APIError("Use 2 to 63 letters, numbers or hyphens, starting with a letter or number.", 400, "VALIDATION_ERROR"));

        const res = await patchPageSlug(request({ path: "Spring Guide!" }), PARAMS);

        expect(res.status).toBe(400);
        expect(mockSetPageSlug).toHaveBeenCalledWith(expect.objectContaining({ path: "spring guide!" }));
    });

    it("uses the team from the session, never a team id sent in the body", async () => {
        const res = await patchPageSlug(request({ path: "spring-guide", teamId: "other-team" }), PARAMS);

        expect(res.status).toBe(200);
        expect(mockSetPageSlug).toHaveBeenCalledWith({ teamId: "team-1", campaignId: "campaign-1", pageId: "page-1", path: "spring-guide" });
    });

    it("returns the conflict when another page already uses the address", async () => {
        mockSetPageSlug.mockRejectedValue(new APIError("This web address is taken. Try another.", 409, "CONFLICT"));

        const res = await patchPageSlug(request({ path: "spring-guide" }), PARAMS);

        expect(res.status).toBe(409);
        expect(await res.text()).toContain("This web address is taken");
    });
});
