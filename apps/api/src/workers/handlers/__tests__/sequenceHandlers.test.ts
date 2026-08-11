import { describe, expect, it, vi } from "vitest";

vi.mock("@/linkedin/puppeteerRunner", () => ({
    runLinkedInAction: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            findUnique: vi.fn(),
            update: vi.fn().mockResolvedValue({}),
        },
    },
}));

vi.mock("@/lib/sequenceService", () => ({
    SequenceService: { scheduleNextStep: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/aiService", () => ({
    aiService: { generateConnectionMessage: vi.fn(), askAI: vi.fn() },
}));

vi.mock("@/modules/email-campaigner/service/emailComposer", () => ({
    composeNodeA: vi.fn(),
}));

vi.mock("@/modules/email-campaigner", () => ({
    emailService: { sendEmail: vi.fn() },
}));

import { handleSequenceAction } from "../sequenceHandlers";
import { runLinkedInAction } from "@/linkedin/puppeteerRunner";

describe("handleSequenceAction VISIT", () => {
    it("calls runLinkedInAction with action/profileUrl, not type/url", async () => {
        await handleSequenceAction({
            leadId: "lead-1",
            url: "https://linkedin.com/in/test-profile",
            action: "VISIT",
        });

        expect(runLinkedInAction).toHaveBeenCalledWith({
            action: "scrape",
            profileUrl: "https://linkedin.com/in/test-profile",
        });
    });
});
