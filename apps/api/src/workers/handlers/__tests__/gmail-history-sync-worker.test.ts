import { describe, expect, it, vi, beforeEach, Mock } from "vitest";
import { handleGmailHistorySync } from "../gmail-history-sync-worker";
import { prisma } from "@/lib/db";
import {
    syncGoogleMailbox,
} from "@/modules/email-campaigner/service/googleMailboxService";

vi.mock("@/lib/db", () => ({
    prisma: {
        connectedMailbox: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({
    syncGoogleMailbox: vi.fn(),
}));

describe("gmail-history-sync-worker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should reject payload if it is null or undefined or not an object", async () => {
        await expect(handleGmailHistorySync(null as any)).rejects.toThrow("Invalid job payload: must be an object.");
        await expect(handleGmailHistorySync([] as any)).rejects.toThrow("Invalid job payload: must be an object.");
    });

    it("should reject payload with missing or empty teamId", async () => {
        await expect(handleGmailHistorySync({ mailboxId: "m1", notificationHistoryId: "123" })).rejects.toThrow(
            "Invalid job payload: teamId must be a non-empty string."
        );
        await expect(handleGmailHistorySync({ teamId: "  ", mailboxId: "m1", notificationHistoryId: "123" })).rejects.toThrow(
            "Invalid job payload: teamId must be a non-empty string."
        );
    });

    it("should reject payload with missing or empty mailboxId", async () => {
        await expect(handleGmailHistorySync({ teamId: "t1", notificationHistoryId: "123" })).rejects.toThrow(
            "Invalid job payload: mailboxId must be a non-empty string."
        );
    });

    it("should reject payload with missing or empty notificationHistoryId", async () => {
        await expect(handleGmailHistorySync({ teamId: "t1", mailboxId: "m1" })).rejects.toThrow(
            "Invalid job payload: notificationHistoryId must be a non-empty string."
        );
    });

    it("should reject payload with malformed pubsubMessageId when present", async () => {
        await expect(handleGmailHistorySync({ teamId: "t1", mailboxId: "m1", notificationHistoryId: "123", pubsubMessageId: 123 as any })).rejects.toThrow(
            "Invalid job payload: pubsubMessageId when present must be a non-empty string."
        );
    });

    it("should reject if mailbox is not found in database", async () => {
        (prisma.connectedMailbox.findUnique as Mock).mockResolvedValueOnce(null);

        await expect(handleGmailHistorySync({ teamId: "t1", mailboxId: "m1", notificationHistoryId: "123" })).rejects.toThrow(
            "Mailbox not found: m1"
        );
    });

    it("should reject if teamId in payload does not match mailbox teamId", async () => {
        (prisma.connectedMailbox.findUnique as Mock).mockResolvedValueOnce({
            id: "m1",
            teamId: "other-team",
            provider: "GOOGLE_WORKSPACE",
        });

        await expect(handleGmailHistorySync({ teamId: "t1", mailboxId: "m1", notificationHistoryId: "123" })).rejects.toThrow(
            "Mismatched team ID:"
        );
    });

    it("should reject if provider is not GOOGLE_WORKSPACE", async () => {
        (prisma.connectedMailbox.findUnique as Mock).mockResolvedValueOnce({
            id: "m1",
            teamId: "t1",
            provider: "MICROSOFT_365",
        });

        await expect(handleGmailHistorySync({ teamId: "t1", mailboxId: "m1", notificationHistoryId: "123" })).rejects.toThrow(
            "Invalid mailbox provider: expected GOOGLE_WORKSPACE"
        );
    });

    it("delegates lease ownership to syncGoogleMailbox and returns non-secret metadata", async () => {
        const mailbox = {
            id: "m1",
            teamId: "t1",
            provider: "GOOGLE_WORKSPACE",
        };
        (prisma.connectedMailbox.findUnique as Mock).mockResolvedValueOnce(mailbox);
        (syncGoogleMailbox as Mock).mockResolvedValueOnce({
            synced: 5,
            replies: 2,
            bounces: 1,
        });

        const result = await handleGmailHistorySync({
            teamId: "t1",
            mailboxId: "m1",
            notificationHistoryId: "123",
            pubsubMessageId: "msg-123",
        });

        expect(syncGoogleMailbox).toHaveBeenCalledWith("t1", "m1");
        expect(syncGoogleMailbox).not.toHaveBeenCalledWith("t1", "m1", expect.objectContaining({
            historyId: "123",
        }));
        expect(result).toEqual({
            mailboxId: "m1",
            synced: 5,
            replies: 2,
            bounces: 1,
        });
    });

    it("should propagate syncGoogleMailbox failures", async () => {
        const mailbox = {
            id: "m1",
            teamId: "t1",
            provider: "GOOGLE_WORKSPACE",
        };
        (prisma.connectedMailbox.findUnique as Mock).mockResolvedValueOnce(mailbox);
        (syncGoogleMailbox as Mock).mockRejectedValueOnce(new Error("API connection error"));

        await expect(handleGmailHistorySync({
            teamId: "t1",
            mailboxId: "m1",
            notificationHistoryId: "123",
        })).rejects.toThrow("API connection error");
    });

    it("propagates lease contention without handler-owned cleanup", async () => {
        (prisma.connectedMailbox.findUnique as Mock).mockResolvedValueOnce({
            id: "m1",
            teamId: "t1",
            provider: "GOOGLE_WORKSPACE",
        });
        (syncGoogleMailbox as Mock).mockRejectedValueOnce(new Error("lease contended"));

        await expect(handleGmailHistorySync({
            teamId: "t1",
            mailboxId: "m1",
            notificationHistoryId: "999",
        })).rejects.toThrow("lease contended");
        expect(syncGoogleMailbox).toHaveBeenCalledWith("t1", "m1");
    });
});
