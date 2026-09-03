import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContextFromRequest: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/flags/guard", () => ({
    withFeatureGuard: vi.fn(async (_key: string, _ctx: unknown, handler: () => Promise<unknown>) => handler()),
}));

vi.mock("@/modules/whatsapp/ConsentService", () => ({
    ConsentService: {
        validateConsent: vi.fn().mockResolvedValue({ hasConsent: true }),
        getConsentHistory: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock("@/modules/whatsapp/TemplateGuard", () => ({
    TemplateGuard: {
        validateMessage: vi.fn().mockResolvedValue({ isValid: true }),
        recordMessageSent: vi.fn().mockResolvedValue(undefined),
    },
}));

vi.mock("@/services/WhatsAppService", () => ({
    WhatsAppService: {
        sendMessage: vi.fn().mockResolvedValue(true),
    },
}));

vi.mock("@/lib/logger", () => ({
    logger: { info: vi.fn(), error: vi.fn() },
}));

import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

function postRequest(body: unknown) {
    return new NextRequest("http://localhost:3001/api/whatsapp/send", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function getRequest(leadId: string) {
    return new NextRequest(`http://localhost:3001/api/whatsapp/send?leadId=${leadId}`);
}

describe("POST /api/whatsapp/send", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("refuses to send to a lead that doesn't belong to the caller's team", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue(null);

        const response = await POST(postRequest({ leadId: "lead-from-team-b", message: "hi" }));

        expect(prisma.lead.findFirst).toHaveBeenCalledWith({
            where: { id: "lead-from-team-b", teamId: "team-a" },
            select: { teamId: true, phone: true },
        });
        expect(response.status).toBe(404);
    });

    it("sends to a lead that does belong to the caller's team", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue({ teamId: "team-a", phone: "+15551234567" });

        const response = await POST(postRequest({ leadId: "lead-1", message: "hi" }));

        expect(response.status).toBe(200);
    });
});

describe("GET /api/whatsapp/send", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("refuses to return consent history for a lead in another team", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue(null);

        const response = await GET(getRequest("lead-from-team-b"));

        expect(prisma.lead.findFirst).toHaveBeenCalledWith({
            where: { id: "lead-from-team-b", teamId: "team-a" },
            select: { id: true },
        });
        expect(response.status).toBe(404);
    });

    it("returns consent history for a lead in the caller's own team", async () => {
        (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1" });

        const response = await GET(getRequest("lead-1"));

        expect(response.status).toBe(200);
    });
});
