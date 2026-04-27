import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mockValidateExtensionAuth = vi.fn();
const mockLeadFindFirst = vi.fn();
const mockLeadUpdate = vi.fn();
const mockLeadCreate = vi.fn();

vi.mock("../_lib/auth", () => ({
    validateExtensionAuth: mockValidateExtensionAuth
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findFirst: mockLeadFindFirst,
            update: mockLeadUpdate,
            create: mockLeadCreate
        }
    }
}));

describe("extension push route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLeadUpdate.mockResolvedValue({ id: "lead-1" });
        mockLeadCreate.mockResolvedValue({ id: "lead-2" });
    });

    it("requires explicit teamId for multi-team users", async () => {
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User", memberships: [{ teamId: "team-a" }, { teamId: "team-b" }] },
            teamIds: ["team-a", "team-b"]
        });

        const { POST } = await import("./route");
        const response = await POST(
            new Request("http://localhost/api/extension/push", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name: "Jane",
                    url: "https://linkedin.com/in/jane"
                })
            }) as any
        );
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload).toEqual({
            ok: false,
            error: "teamId is required for multi-team users",
            code: "TEAM_ID_REQUIRED"
        });
        expect(mockLeadFindFirst).not.toHaveBeenCalled();
    });

    it("rejects invalid LinkedIn url", async () => {
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User", memberships: [{ teamId: "team-a" }] },
            teamIds: ["team-a"]
        });

        const { POST } = await import("./route");
        const response = await POST(
            new Request("http://localhost/api/extension/push", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    teamId: "team-a",
                    name: "Jane",
                    url: "http://linkedin.com/in/jane"
                })
            }) as any
        );
        const payload = await response.json();

        expect(response.status).toBe(400);
        expect(payload).toEqual({
            ok: false,
            error: "Valid LinkedIn profile url is required",
            code: "INVALID_LINKEDIN_URL"
        });
        expect(mockLeadFindFirst).not.toHaveBeenCalled();
    });

    it("updates existing lead with sparse fields and no undefined about", async () => {
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User", memberships: [{ teamId: "team-a" }] },
            teamIds: ["team-a"]
        });
        mockLeadFindFirst.mockResolvedValue({
            id: "lead-1",
            enrichedData: { source: "legacy", keep: "yes" }
        });

        const { POST } = await import("./route");
        const response = await POST(
            new Request("http://localhost/api/extension/push", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    url: "https://linkedin.com/in/jane"
                })
            }) as any
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.ok).toBe(true);
        expect(mockLeadUpdate).toHaveBeenCalledTimes(1);

        const updateCall = (mockLeadUpdate as Mock).mock.calls[0]?.[0];
        expect(updateCall.where).toEqual({ id: "lead-1" });
        expect(updateCall.data.fullName).toBeUndefined();
        expect(updateCall.data.jobTitle).toBeUndefined();
        expect(updateCall.data.location).toBeUndefined();
        expect(updateCall.data.enrichedData.source).toBe("extension_scrape");
        expect(updateCall.data.enrichedData.keep).toBe("yes");
        expect(updateCall.data.enrichedData.about).toBeUndefined();
        expect(typeof updateCall.data.enrichedData.sourceCapturedAt).toBe("string");
    });

    it("creates lead for single-team user without teamId in payload", async () => {
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User", memberships: [{ teamId: "team-a" }] },
            teamIds: ["team-a"]
        });
        mockLeadFindFirst.mockResolvedValue(null);

        const { POST } = await import("./route");
        const response = await POST(
            new Request("http://localhost/api/extension/push", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name: "Jane",
                    headline: "Founder",
                    location: "Dubai",
                    about: "Reach me at jane@example.com",
                    url: "https://linkedin.com/in/jane"
                })
            }) as any
        );
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.ok).toBe(true);
        expect(mockLeadCreate).toHaveBeenCalledTimes(1);

        const createCall = (mockLeadCreate as Mock).mock.calls[0]?.[0];
        expect(createCall.data.teamId).toBe("team-a");
        expect(createCall.data.linkedIn).toBe("https://linkedin.com/in/jane");
        expect(createCall.data.fullName).toBe("Jane");
        expect(createCall.data.jobTitle).toBe("Founder");
        expect(createCall.data.location).toBe("Dubai");
        expect(createCall.data.enrichedData.source).toBe("extension_scrape");
        expect(createCall.data.enrichedData.about).toContain("[REDACTED-EMAIL]");
    });
});

