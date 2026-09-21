import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateExtensionAuth = vi.fn();
const mockSystemEventCreate = vi.fn();

vi.mock("../_lib/auth", () => ({
    validateExtensionAuth: mockValidateExtensionAuth
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        systemEvent: { create: mockSystemEventCreate }
    }
}));

function authAs(teamIds: string[]) {
    mockValidateExtensionAuth.mockResolvedValue({
        ok: true,
        user: { id: "user-1", email: "u@example.com", name: "User", memberships: teamIds.map((teamId) => ({ teamId })) },
        teamIds
    });
}

function postReq(body: unknown) {
    return new Request("http://localhost/api/extension/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    }) as any;
}

describe("extension action route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSystemEventCreate.mockResolvedValue({ id: "event-1" });
        authAs(["team-a"]);
    });

    it("records a valid manual action as a system event", async () => {
        const { POST } = await import("./route");
        const res = await POST(postReq({ action: "OPEN_PROFILE", status: "SUCCESS", profileUrl: "https://www.linkedin.com/in/x/" }));
        expect(res.status).toBe(200);
        expect((await res.json()).ok).toBe(true);
        expect(mockSystemEventCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ name: "EXTENSION_MANUAL_ACTION", teamId: "team-a", payload: expect.objectContaining({ action: "OPEN_PROFILE" }) })
            })
        );
    });

    it("rejects an invalid action", async () => {
        const { POST } = await import("./route");
        const res = await POST(postReq({ action: "WIPE_DB" }));
        expect(res.status).toBe(400);
        expect((await res.json()).code).toBe("INVALID_ACTION");
        expect(mockSystemEventCreate).not.toHaveBeenCalled();
    });

    it("rejects an unauthenticated request", async () => {
        mockValidateExtensionAuth.mockResolvedValue({ ok: false, error: "no token", code: "NO_TOKEN", status: 401 });
        const { POST } = await import("./route");
        const res = await POST(postReq({ action: "OPEN_PROFILE" }));
        expect(res.status).toBe(401);
        expect(mockSystemEventCreate).not.toHaveBeenCalled();
    });
});
