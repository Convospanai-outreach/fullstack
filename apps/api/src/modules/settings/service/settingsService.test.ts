import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        settings: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        notificationSettings: { create: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { settingsService } from "./settingsService";
import { decryptCredential } from "@/lib/security/credentialVault";

process.env["ENCRYPTION_KEY"] = "a".repeat(64);

describe("settingsService.updateSettings - drops unallowlisted fields (OPEN-220)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.settings.update.mockResolvedValue({ id: "settings-1", userId: "user-1" });
    });

    it("does not let an attacker re-key their Settings row to another user's userId", async () => {
        await settingsService.updateSettings("user-1", {
            userId: "victim-user-id",
            id: "other-settings-id",
            apiKeyOpenAI: "sk-mine",
        });

        expect(mockPrisma.settings.update).toHaveBeenCalledWith({
            where: { userId: "user-1" },
            data: expect.objectContaining({ apiKeyOpenAI: expect.any(String) }),
        });
        const call = mockPrisma.settings.update.mock.calls[0][0];
        expect(call.data.userId).toBeUndefined();
        expect(call.data.id).toBeUndefined();
    });
});

describe("settingsService.updateNotifications - drops unallowlisted fields (OPEN-220)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.settings.findUnique.mockResolvedValue({
            id: "settings-1",
            userId: "user-1",
            notifications: { settingsId: "settings-1", userId: "user-1" },
        });
        mockPrisma.notificationSettings.update.mockResolvedValue({ settingsId: "settings-1" });
    });

    it("does not let an attacker re-key notification settings via settingsId", async () => {
        await settingsService.updateNotifications("user-1", {
            settingsId: "other-settings-id",
            userId: "victim-user-id",
            emailGlobal: false,
        });

        expect(mockPrisma.notificationSettings.update).toHaveBeenCalledWith({
            where: { settingsId: "settings-1" },
            data: expect.objectContaining({ emailGlobal: false }),
        });
        const call = mockPrisma.notificationSettings.update.mock.calls[0][0];
        expect(call.data.settingsId).toBeUndefined();
        expect(call.data.userId).toBeUndefined();
    });
});

describe("settingsService secret fields", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.settings.update.mockResolvedValue({ id: "settings-1", userId: "user-1" });
    });

    const written = () => mockPrisma.settings.update.mock.calls[0][0].data;

    it("encrypts secrets before they reach the database", async () => {
        await settingsService.updateSettings("user-1", { apiKeyOpenAI: "sk-live-1234", liCookie: "AQEDAR-cookie" });

        expect(written().apiKeyOpenAI).not.toContain("sk-live-1234");
        expect(written().liCookie).not.toContain("AQEDAR-cookie");
        expect(await decryptCredential(JSON.parse(written().apiKeyOpenAI))).toBe("sk-live-1234");
    });

    it("keeps the stored value when a field is omitted or echoes back its masked form", async () => {
        await settingsService.updateSettings("user-1", { apiKeyOpenAI: "••••1234", hubspotApiKey: undefined, theme: "dark" });

        expect(written().apiKeyOpenAI).toBeUndefined();
        expect(written().hubspotApiKey).toBeUndefined();
    });

    it("clears a secret when it is sent empty", async () => {
        await settingsService.updateSettings("user-1", { apiKeyGemini: "" });

        expect(written().apiKeyGemini).toBeNull();
    });

    it("returns secrets masked to clients, for both encrypted and legacy plaintext rows", async () => {
        await settingsService.updateSettings("user-1", { hubspotApiKey: "pat-na1-abcdef-9876" });
        const encrypted = written().hubspotApiKey;
        mockPrisma.settings.findUnique.mockResolvedValue({
            id: "settings-1",
            userId: "user-1",
            theme: "dark",
            apiKeyOpenAI: "sk-legacy-plaintext-5678",
            apiKeyGemini: null,
            hubspotApiKey: encrypted,
            liCookie: "short",
            notifications: { settingsId: "settings-1" },
        });

        const out = await settingsService.getSettingsForClient("user-1");

        expect(out.apiKeyOpenAI).toBe("••••5678");
        expect(out.hubspotApiKey).toBe("••••9876");
        expect(out.apiKeyGemini).toBeNull();
        expect(out.liCookie).toBe("••••");
        expect(out.theme).toBe("dark");
        expect(JSON.stringify(out)).not.toMatch(/legacy-plaintext|pat-na1|"cipher"/);
    });
});
