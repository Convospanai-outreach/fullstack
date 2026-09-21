import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateExtensionAuth = vi.fn();
const mockLeadUpsert = vi.fn();

vi.mock("../_lib/auth", () => ({
    validateExtensionAuth: mockValidateExtensionAuth
}));

vi.mock("@/services/LeadService", () => ({
    LeadService: { upsert: mockLeadUpsert }
}));

function authAs(teamIds: string[]) {
    mockValidateExtensionAuth.mockResolvedValue({
        ok: true,
        user: { id: "user-1", email: "u@example.com", name: "User", memberships: teamIds.map((teamId) => ({ teamId })) },
        teamIds
    });
}

function postReq(body: unknown) {
    return new Request("http://localhost/api/extension/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    }) as any;
}

describe("extension leads route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLeadUpsert.mockResolvedValue({ id: "lead-1" });
        authAs(["team-a"]);
    });

    it("upserts a lead from a valid LinkedIn profile URL, scoped to the team", async () => {
        const { POST } = await import("./route");
        const res = await POST(postReq({ name: "Jane", profileUrl: "https://www.linkedin.com/in/jane/?utm=x", company: "CMF", headline: "CEO" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({ ok: true, lead: { id: "lead-1" } });
        expect(mockLeadUpsert).toHaveBeenCalledWith(
            "team-a",
            "user-1",
            expect.objectContaining({ linkedIn: "https://www.linkedin.com/in/jane/", company: "CMF", jobTitle: "CEO" })
        );
    });

    it("rejects a non-LinkedIn or malformed profile URL", async () => {
        const { POST } = await import("./route");
        const res = await POST(postReq({ name: "Jane", profileUrl: "https://example.com/in/jane" }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("INVALID_LINKEDIN_URL");
        expect(mockLeadUpsert).not.toHaveBeenCalled();
    });

    it("rejects an unauthenticated request", async () => {
        mockValidateExtensionAuth.mockResolvedValue({ ok: false, error: "no token", code: "NO_TOKEN", status: 401 });
        const { POST } = await import("./route");
        const res = await POST(postReq({ profileUrl: "https://www.linkedin.com/in/jane/" }));
        expect(res.status).toBe(401);
        expect(mockLeadUpsert).not.toHaveBeenCalled();
    });
});
