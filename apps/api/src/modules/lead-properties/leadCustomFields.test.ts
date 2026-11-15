import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockLoggerWarn } = vi.hoisted(() => ({
    mockPrisma: {
        leadProperty: { findMany: vi.fn() },
        lead: { findFirst: vi.fn(), updateMany: vi.fn() },
    },
    mockLoggerWarn: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { warn: mockLoggerWarn, info: vi.fn(), error: vi.fn() } }));

import { saveLandingAnswersToLead } from "./leadCustomFields";

const TEAM = "team-1";

describe("saveLandingAnswersToLead", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.leadProperty.findMany.mockResolvedValue([
            { key: "budget", type: "number", options: null, archivedAt: null },
            { key: "start_date", type: "date", options: null, archivedAt: null },
            { key: "old_code", type: "text", options: null, archivedAt: new Date() },
        ]);
        mockPrisma.lead.findFirst.mockResolvedValue({ customFields: { start_date: "2026-01-02" } });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
    });

    it("writes matching answers, coerced by type, into the lead's customFields", async () => {
        await saveLandingAnswersToLead(TEAM, "lead-1", { answers: { budget: "500", what_else: "hi" } });

        expect(mockPrisma.leadProperty.findMany).toHaveBeenCalledWith({ where: { teamId: TEAM, archivedAt: null } });
        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: TEAM },
            data: { customFields: { start_date: "2026-01-02", budget: 500 } },
        });
    });

    it("does nothing when the payload has no answers", async () => {
        await saveLandingAnswersToLead(TEAM, "lead-1", null);
        await saveLandingAnswersToLead(TEAM, "lead-1", { answers: { what_else: "hi" } });

        expect(mockPrisma.lead.updateMany).not.toHaveBeenCalled();
    });

    it("ignores archived properties", async () => {
        await saveLandingAnswersToLead(TEAM, "lead-1", { answers: { old_code: "abc" } });

        expect(mockPrisma.lead.updateMany).not.toHaveBeenCalled();
    });

    it("skips a wrong-typed answer, keeps the rest, and never throws", async () => {
        await saveLandingAnswersToLead(TEAM, "lead-1", { answers: { budget: "lots", start_date: "2026-03-04" } });

        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: TEAM },
            data: { customFields: { start_date: "2026-03-04" } },
        });
        expect(mockLoggerWarn).toHaveBeenCalled();
        const logged = mockLoggerWarn.mock.calls.map((call) => JSON.stringify(call)).join(" ");
        expect(logged).not.toContain("lots");
    });

    it("writes nothing when every answer is invalid", async () => {
        await saveLandingAnswersToLead(TEAM, "lead-1", { answers: { budget: "lots" } });

        expect(mockPrisma.lead.updateMany).not.toHaveBeenCalled();
    });
});
