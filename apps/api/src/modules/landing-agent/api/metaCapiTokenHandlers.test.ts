import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockRequireTeam } = vi.hoisted(() => ({
    mockPrisma: { team: { findUnique: vi.fn(), update: vi.fn() } },
    mockRequireTeam: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("./handlers", () => ({ requireTeamContext: mockRequireTeam }));

import { TeamRole } from "@/lib/permissions";
import { decryptCredential } from "@/lib/security/credentialVault";
import { deleteMetaCapiToken, getMetaCapiToken, putMetaCapiToken } from "./metaCapiTokenHandlers";

const TOKEN = "EAAB-long-test-access-token-value";

function req(method: string, body?: unknown) {
    return new Request("https://api.example.test/landing-agent/meta-capi-token", {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

describe("Meta Conversions API token endpoints", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["ENCRYPTION_KEY"] = "b".repeat(64);
        mockRequireTeam.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("reports only whether a token is saved, never the token", async () => {
        mockPrisma.team.findUnique.mockResolvedValue({ metaCapiTokenEnc: { v: 1, cipher: "x", iv: "y", tag: "z" } });
        const res = await getMetaCapiToken(req("GET"));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ saved: true });
        expect(mockRequireTeam).toHaveBeenCalledWith(expect.anything(), TeamRole.ADMIN);
        expect(mockPrisma.team.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "team-1" } }));

        mockPrisma.team.findUnique.mockResolvedValue({ metaCapiTokenEnc: null });
        expect(await (await getMetaCapiToken(req("GET"))).json()).toMatchObject({ saved: false });
    });

    it("stores the token encrypted with the existing credential vault, team-scoped, and returns no token", async () => {
        const res = await putMetaCapiToken(req("PUT", { accessToken: TOKEN }));
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).not.toContain(TOKEN);
        expect(JSON.parse(text)).toMatchObject({ saved: true });

        const update = mockPrisma.team.update.mock.calls[0]![0];
        expect(update.where).toEqual({ id: "team-1" });
        const stored = update.data.metaCapiTokenEnc;
        expect(JSON.stringify(stored)).not.toContain(TOKEN);
        expect(await decryptCredential(stored)).toBe(TOKEN);
    });

    it("rejects an empty or missing token without saving", async () => {
        const res = await putMetaCapiToken(req("PUT", { accessToken: "   " }));
        expect(res.status).toBe(400);
        expect(mockPrisma.team.update).not.toHaveBeenCalled();
    });

    it("clears the saved token", async () => {
        const res = await deleteMetaCapiToken(req("DELETE"));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ saved: false });
        expect(mockPrisma.team.update.mock.calls[0]![0].where).toEqual({ id: "team-1" });
        expect(mockPrisma.team.update.mock.calls[0]![0].data.metaCapiTokenEnc).not.toBeUndefined();
    });
});
