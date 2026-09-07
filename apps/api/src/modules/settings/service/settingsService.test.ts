import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        settings: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
        notificationSettings: { create: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { settingsService } from "./settingsService";

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
            data: expect.objectContaining({ apiKeyOpenAI: "sk-mine" }),
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
