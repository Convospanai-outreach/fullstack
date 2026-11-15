import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetContext, mockAuthorizeRole, mockPutImage, mockStorageConfigured, mockRateLimit } = vi.hoisted(() => ({
    mockGetContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockPutImage: vi.fn(),
    mockStorageConfigured: vi.fn(),
    mockRateLimit: vi.fn(),
}));

vi.mock("../service", () => ({ landingAgentService: {} }));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetContext }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: mockAuthorizeRole, TeamRole: { VIEWER: "VIEWER", MEMBER: "MEMBER" } }));
vi.mock("../service/imageGenerationService", () => ({
    putLandingImage: mockPutImage,
    isLandingImageStorageConfigured: mockStorageConfigured,
}));
vi.mock("@/lib/apiRateLimit", () => ({
    checkApiRateLimit: mockRateLimit,
    rateLimitResponse: (resetIn: number) =>
        Response.json({ error: "Too many requests. Please try again later." }, { status: 429, headers: { "Retry-After": String(resetIn) } }),
}));

import { APIError } from "@/lib/apiResponse";
import { MAX_LANDING_IMAGE_BYTES } from "../imageUpload";
import { postLandingImage } from "./handlers";

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(56).fill(0)]);
const PUBLIC_URL = "https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/landing-images/team-a/x.png";

function uploadRequest(bytes: Uint8Array | string, fileName = "hero.png", type = "image/png"): Request {
    const form = new FormData();
    form.append("file", new File([bytes], fileName, { type }));
    return new Request("http://localhost/api/landing-agent/images", { method: "POST", body: form });
}

describe("postLandingImage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockRateLimit.mockResolvedValue({ success: true, remaining: 99 });
        mockStorageConfigured.mockReturnValue(true);
        mockPutImage.mockResolvedValue(PUBLIC_URL);
    });

    it("rejects an unauthenticated request with 401 and stores nothing", async () => {
        mockGetContext.mockResolvedValue({ userId: undefined, teamId: undefined });

        const res = await postLandingImage(uploadRequest(PNG_BYTES));

        expect(res.status).toBe(401);
        expect(mockPutImage).not.toHaveBeenCalled();
    });

    it("rejects a user who is not a member of the team with 403 and stores nothing", async () => {
        mockAuthorizeRole.mockRejectedValue(new APIError("Forbidden", 403, "FORBIDDEN"));

        const res = await postLandingImage(uploadRequest(PNG_BYTES));

        expect(res.status).toBe(403);
        expect(mockAuthorizeRole).toHaveBeenCalledWith("user-1", "team-a", "MEMBER");
        expect(mockPutImage).not.toHaveBeenCalled();
    });

    it("rejects a file whose bytes are not an image even when named .png, with 415", async () => {
        const res = await postLandingImage(uploadRequest("just some text, not a picture at all"));

        expect(res.status).toBe(415);
        expect(mockPutImage).not.toHaveBeenCalled();
    });

    it("rejects a GIF with 415", async () => {
        const gif = new TextEncoder().encode("GIF89a" + "x".repeat(40));
        const res = await postLandingImage(uploadRequest(gif, "hero.gif", "image/gif"));

        expect(res.status).toBe(415);
        expect(mockPutImage).not.toHaveBeenCalled();
    });

    it("rejects a file over 2 MB with 413", async () => {
        const big = new Uint8Array(MAX_LANDING_IMAGE_BYTES + 1);
        big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);

        const res = await postLandingImage(uploadRequest(big));

        expect(res.status).toBe(413);
        expect(mockPutImage).not.toHaveBeenCalled();
    });

    it("rejects a request with no file field with 400", async () => {
        const form = new FormData();
        form.append("note", "no file here");

        const res = await postLandingImage(new Request("http://localhost/api/landing-agent/images", { method: "POST", body: form }));

        expect(res.status).toBe(400);
        expect(mockPutImage).not.toHaveBeenCalled();
    });

    it("is rate limited per team and stores nothing when the limit is hit", async () => {
        mockRateLimit.mockResolvedValue({ success: false, remaining: 0, resetIn: 30 });

        const res = await postLandingImage(uploadRequest(PNG_BYTES));

        expect(res.status).toBe(429);
        expect(res.headers.get("Retry-After")).toBe("30");
        expect(mockRateLimit).toHaveBeenCalledWith(expect.stringContaining("team-a"));
        expect(mockPutImage).not.toHaveBeenCalled();
    });

    it("returns 503 when landing image storage is not configured", async () => {
        mockStorageConfigured.mockReturnValue(false);

        const res = await postLandingImage(uploadRequest(PNG_BYTES));

        expect(res.status).toBe(503);
        expect(mockPutImage).not.toHaveBeenCalled();
    });

    it("stores a valid PNG under the caller's team and returns its public URL", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");

        const res = await postLandingImage(uploadRequest(PNG_BYTES, "../../evil.jpg", "image/jpeg"));

        expect(res.status).toBe(201);
        expect(await res.json()).toEqual({ url: PUBLIC_URL });
        const [objectPath, bytes, contentType] = mockPutImage.mock.calls[0];
        expect(objectPath).toMatch(/^team-a\/[0-9a-f-]{36}\.png$/);
        expect(contentType).toBe("image/png");
        expect(bytes.byteLength).toBe(PNG_BYTES.byteLength);
        expect(fetchSpy).not.toHaveBeenCalled();
        fetchSpy.mockRestore();
    });
});
