import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetContext, mockAuthorizeRole, mockSave, mockList } = vi.hoisted(() => ({
    mockGetContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockSave: vi.fn(),
    mockList: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetContext }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: mockAuthorizeRole, TeamRole: { VIEWER: "VIEWER", MEMBER: "MEMBER" } }));
vi.mock("../service", () => ({ landingAgentService: { savePageInstantConfirmation: mockSave, listInstantConfirmationSequences: mockList } }));
vi.mock("../service/imageGenerationService", () => ({ isLandingImageStorageConfigured: vi.fn(), putLandingImage: vi.fn() }));
vi.mock("../rendering", () => ({ sanitizeRenderedJsonHtml: vi.fn() }));
vi.mock("@/lib/apiRateLimit", () => ({ checkApiRateLimit: vi.fn(), rateLimitResponse: vi.fn() }));

import { getInstantConfirmationSequences, putPageInstantConfirmation } from "./handlers";
import { APIError } from "@/lib/apiResponse";

const PARAMS = { params: Promise.resolve({ id: "campaign-1", pageId: "page-1" }) };

function request(body: unknown): Request {
    return new Request("https://app.example/api/landing-agent/campaigns/campaign-1/pages/page-1/instant-confirmation", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("GET /landing-agent/instant-confirmation/sequences", () => {
    const listRequest = () => new Request("https://app.example/api/landing-agent/instant-confirmation/sequences?teamId=team-b");
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockList.mockResolvedValue([{ id: "seq-1", name: "Welcome", channel: "email" }]);
    });

    it("requires a signed-in user with a team", async () => {
        mockGetContext.mockResolvedValue({});
        expect((await getInstantConfirmationSequences(listRequest())).status).toBe(401);
        expect(mockList).not.toHaveBeenCalled();
    });

    it("requires at least member access to the team", async () => {
        mockAuthorizeRole.mockRejectedValue(new APIError("Forbidden", 403, "FORBIDDEN"));
        expect((await getInstantConfirmationSequences(listRequest())).status).toBe(403);
        expect(mockAuthorizeRole).toHaveBeenCalledWith("user-1", "team-1", "MEMBER");
        expect(mockList).not.toHaveBeenCalled();
    });

    it("lists the signed-in team's sequences only, ignoring a team id in the query", async () => {
        const res = await getInstantConfirmationSequences(listRequest());
        expect(res.status).toBe(200);
        expect(mockList).toHaveBeenCalledWith("team-1");
        expect(await res.text()).toContain("seq-1");
    });
});

describe("PUT /landing-agent/campaigns/:id/pages/:pageId/instant-confirmation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockSave.mockResolvedValue({ id: "page-1" });
    });

    it("requires a signed-in user with a team", async () => {
        mockGetContext.mockResolvedValue({});
        const res = await putPageInstantConfirmation(request({ enabled: false, sequenceId: "" }), PARAMS);
        expect(res.status).toBe(401);
        expect(mockSave).not.toHaveBeenCalled();
    });

    it("requires at least member access to the team", async () => {
        mockAuthorizeRole.mockRejectedValue(new APIError("Forbidden", 403, "FORBIDDEN"));
        const res = await putPageInstantConfirmation(request({ enabled: true, sequenceId: "seq-1" }), PARAMS);
        expect(res.status).toBe(403);
        expect(mockAuthorizeRole).toHaveBeenCalledWith("user-1", "team-1", "MEMBER");
        expect(mockSave).not.toHaveBeenCalled();
    });

    it("refuses switching on without a sequence before the service is called", async () => {
        const res = await putPageInstantConfirmation(request({ enabled: true, sequenceId: "" }), PARAMS);
        expect(res.status).toBe(400);
        expect(mockSave).not.toHaveBeenCalled();
    });

    it("refuses a body without the switch", async () => {
        const res = await putPageInstantConfirmation(request({ sequenceId: "seq-1" }), PARAMS);
        expect(res.status).toBe(400);
        expect(mockSave).not.toHaveBeenCalled();
    });

    it("uses the signed-in team, never a team id sent in the body", async () => {
        const res = await putPageInstantConfirmation(request({ enabled: true, sequenceId: "seq-1", teamId: "team-b" }), PARAMS);
        expect(res.status).toBe(200);
        expect(mockSave).toHaveBeenCalledWith({
            teamId: "team-1",
            campaignId: "campaign-1",
            pageId: "page-1",
            setting: { enabled: true, sequenceId: "seq-1" },
        });
    });

    it("returns the service's refusal of a sequence (wrong team, not one step, ...)", async () => {
        mockSave.mockRejectedValue(new APIError("Pick a sequence with exactly one active step.", 400, "VALIDATION_ERROR"));
        const res = await putPageInstantConfirmation(request({ enabled: true, sequenceId: "seq-2" }), PARAMS);
        expect(res.status).toBe(400);
        expect(await res.text()).toContain("exactly one active step");
    });
});
