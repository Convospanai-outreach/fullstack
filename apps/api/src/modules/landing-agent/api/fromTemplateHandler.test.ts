import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetContext, mockAuthorizeRole, mockCreate } = vi.hoisted(() => ({
    mockGetContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetContext }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: mockAuthorizeRole, TeamRole: { VIEWER: "VIEWER", MEMBER: "MEMBER" } }));
vi.mock("../service", () => ({ landingAgentService: { createCampaignFromTemplate: mockCreate } }));

import { postCampaignFromTemplate } from "./fromTemplateHandler";
import { APIError } from "@/lib/apiResponse";

function request(body: unknown): Request {
    return new Request("https://app.example/api/landing-agent/campaigns/from-template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("POST /landing-agent/campaigns/from-template", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockCreate.mockResolvedValue({ campaignId: "lc-1", pageId: "lp-1" });
    });

    it("creates the page and returns the ids", async () => {
        const res = await postCampaignFromTemplate(request({ templateId: "free-guide", name: "Spring guide" }));

        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ campaignId: "lc-1", pageId: "lp-1" });
        expect(mockCreate).toHaveBeenCalledWith({ teamId: "team-1", userId: "user-1", templateId: "free-guide", name: "Spring guide" });
    });

    it("uses the team from the session, never a team id sent in the body", async () => {
        await postCampaignFromTemplate(request({ templateId: "free-guide", name: "Spring guide", teamId: "other-team" }));

        expect(mockCreate.mock.calls[0]?.[0].teamId).toBe("team-1");
    });

    it("refuses a user who is not a member of the team, and creates nothing", async () => {
        mockAuthorizeRole.mockRejectedValue(new APIError("Forbidden", 403, "FORBIDDEN"));

        const res = await postCampaignFromTemplate(request({ templateId: "free-guide", name: "Spring guide" }));

        expect(res.status).toBe(403);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("requires a signed-in user with a team", async () => {
        mockGetContext.mockResolvedValue({});

        const res = await postCampaignFromTemplate(request({ templateId: "free-guide", name: "Spring guide" }));

        expect(res.status).toBe(401);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("rejects a template id that is not in the gallery", async () => {
        const res = await postCampaignFromTemplate(request({ templateId: "not-a-template", name: "Spring guide" }));

        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it.each([
        ["an empty name", { templateId: "free-guide", name: "" }],
        ["a name of only spaces", { templateId: "free-guide", name: "    " }],
        ["a name over 200 characters", { templateId: "free-guide", name: "x".repeat(201) }],
        ["a missing name", { templateId: "free-guide" }],
    ])("rejects %s", async (_label, body) => {
        const res = await postCampaignFromTemplate(request(body));

        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });
});
