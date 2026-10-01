import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentContext: vi.fn() }));
vi.mock("@/lib/hiddenFeaturesReadiness", () => ({ resolveEnabledFeatureKeys: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: vi.fn(), TeamRole: { MEMBER: "member" } }));
vi.mock("@/lib/supabaseStorage", () => ({ uploadPublicFile: vi.fn(async (_b: string, path: string) => ({ url: `https://x.supabase.co/storage/v1/object/public/content-media/${path}` })) }));

import { POST } from "./route";
import { getCurrentContext } from "@/lib/auth";
import { resolveEnabledFeatureKeys } from "@/lib/hiddenFeaturesReadiness";
import { uploadPublicFile } from "@/lib/supabaseStorage";
import { checkTeamPermission } from "@/lib/permissions";

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10];
const upload = (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return POST({ formData: async () => form } as any);
};

describe("POST /api/content/media", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContext as any).mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        (resolveEnabledFeatureKeys as any).mockResolvedValue(new Set(["creator-funnel"]));
        (checkTeamPermission as any).mockResolvedValue(true);
    });

    it("doesn't let viewers upload", async () => {
        (checkTeamPermission as any).mockResolvedValue(false);
        expect((await upload(new File([new Uint8Array(JPEG)], "photo.jpg", { type: "image/jpeg" }))).status).toBe(403);
        expect(uploadPublicFile).not.toHaveBeenCalled();
    });

    it("stores a JPEG under the team's folder with a random name", async () => {
        const res = await upload(new File([new Uint8Array(JPEG)], "photo.jpg", { type: "image/jpeg" }));
        expect(res.status).toBe(200);
        const path = (uploadPublicFile as any).mock.calls[0][1];
        expect((uploadPublicFile as any).mock.calls[0][0]).toBe("content-media");
        expect(path).toMatch(/^team-1\/[0-9a-f-]{36}\.jpg$/);
    });

    it("rejects anything that isn't really a JPEG", async () => {
        expect((await upload(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "a.png", { type: "image/png" }))).status).toBe(400);
        expect((await upload(new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "a.jpg", { type: "image/jpeg" }))).status).toBe(400);
        expect(uploadPublicFile).not.toHaveBeenCalled();
    });

    it("rejects files over 8 MB", async () => {
        const big = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" });
        expect((await upload(big)).status).toBe(413);
    });

    it("404s when the creator funnel is off", async () => {
        (resolveEnabledFeatureKeys as any).mockResolvedValue(new Set());
        expect((await upload(new File([new Uint8Array(JPEG)], "photo.jpg", { type: "image/jpeg" }))).status).toBe(404);
    });
});
