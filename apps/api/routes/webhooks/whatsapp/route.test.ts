import { beforeEach, describe, expect, it, vi, Mock } from "vitest";
import crypto from "crypto";

const { mockPrisma, mockAdvanceLeadAfterReply } = vi.hoisted(() => ({
    mockPrisma: {
        team: { findFirst: vi.fn() },
        lead: { findFirst: vi.fn() },
        whatsAppMessage: { create: vi.fn() },
    },
    mockAdvanceLeadAfterReply: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/crm/leadStageTransitions", () => ({ advanceLeadAfterReply: mockAdvanceLeadAfterReply }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const VERIFY_TOKEN = "test-verify-token";
const APP_SECRET = "test-app-secret";

function messagePayload(overrides: Partial<{ phoneNumberId: string; from: string; text: string }> = {}) {
    return {
        entry: [{
            id: "waba-1",
            changes: [{
                field: "messages",
                value: {
                    metadata: { phone_number_id: overrides.phoneNumberId ?? "phone-number-1" },
                    messages: [{ from: overrides.from ?? "919876543210", id: "wamid.1", type: "text", text: { body: overrides.text ?? "Hi there" } }],
                },
            }],
        }],
    };
}

function signedRequest(body: any, secret = APP_SECRET) {
    const rawBody = JSON.stringify(body);
    const signature = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    return new Request("http://localhost/webhooks/whatsapp", {
        method: "POST",
        headers: { "x-hub-signature-256": signature, "content-type": "application/json" },
        body: rawBody,
    });
}

describe("/webhooks/whatsapp", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"] = VERIFY_TOKEN;
        process.env["WHATSAPP_APP_SECRET"] = APP_SECRET;
        mockPrisma.team.findFirst.mockResolvedValue({ id: "team-1" });
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", teamId: "team-1" });
        mockPrisma.whatsAppMessage.create.mockResolvedValue({ id: "msg-1" });
        mockAdvanceLeadAfterReply.mockResolvedValue({ leadStageChanged: true });
    });

    describe("GET - verification handshake", () => {
        it("echoes hub.challenge when the mode and token match", async () => {
            const { GET } = await import("./route");
            const req = new Request(
                `http://localhost/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345`,
            );

            const res = await GET(req as any);

            expect(res.status).toBe(200);
            expect(await res.text()).toBe("12345");
        });

        it("rejects a mismatched verify token with 403", async () => {
            const { GET } = await import("./route");
            const req = new Request(
                "http://localhost/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345",
            );

            const res = await GET(req as any);

            expect(res.status).toBe(403);
        });

        it("returns 503 when WHATSAPP_WEBHOOK_VERIFY_TOKEN isn't configured", async () => {
            delete process.env["WHATSAPP_WEBHOOK_VERIFY_TOKEN"];
            const { GET } = await import("./route");
            const req = new Request(
                `http://localhost/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=12345`,
            );

            const res = await GET(req as any);

            expect(res.status).toBe(503);
        });
    });

    describe("POST - signature verification", () => {
        it("rejects a request with no signature when WHATSAPP_APP_SECRET is configured", async () => {
            const { POST } = await import("./route");
            const rawBody = JSON.stringify(messagePayload());

            const res = await POST(new Request("http://localhost/webhooks/whatsapp", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: rawBody,
            }) as any);

            expect(res.status).toBe(400);
            expect(mockPrisma.whatsAppMessage.create).not.toHaveBeenCalled();
        });

        it("rejects an incorrect signature", async () => {
            const { POST } = await import("./route");
            const res = await POST(signedRequest(messagePayload(), "wrong-secret") as any);

            expect(res.status).toBe(400);
            expect(mockPrisma.whatsAppMessage.create).not.toHaveBeenCalled();
        });

        it("accepts unsigned payloads when WHATSAPP_APP_SECRET isn't configured", async () => {
            delete process.env["WHATSAPP_APP_SECRET"];
            const { POST } = await import("./route");
            const rawBody = JSON.stringify(messagePayload());

            const res = await POST(new Request("http://localhost/webhooks/whatsapp", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: rawBody,
            }) as any);

            expect(res.status).toBe(200);
            expect(mockPrisma.whatsAppMessage.create).toHaveBeenCalled();
        });

        it("rejects invalid JSON with 400", async () => {
            const { POST } = await import("./route");
            const rawBody = "not json";
            const signature = `sha256=${crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex")}`;

            const res = await POST(new Request("http://localhost/webhooks/whatsapp", {
                method: "POST",
                headers: { "x-hub-signature-256": signature, "content-type": "application/json" },
                body: rawBody,
            }) as any);

            expect(res.status).toBe(400);
        });
    });

    describe("POST - inbound message processing", () => {
        it("records an inbound message and advances the lead's journey", async () => {
            const { POST } = await import("./route");

            const res = await POST(signedRequest(messagePayload({ from: "919876543210", text: "Interested, tell me more" })) as any);

            expect(res.status).toBe(200);
            expect(mockPrisma.team.findFirst).toHaveBeenCalledWith({
                where: { whatsappPhoneNumberId: "phone-number-1" },
                select: { id: true },
            });
            expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({
                where: { teamId: "team-1", phone: { endsWith: "9876543210" } },
                select: { id: true, teamId: true },
            });
            expect(mockPrisma.whatsAppMessage.create).toHaveBeenCalledWith({
                data: { leadId: "lead-1", body: "Interested, tell me more", direction: "INBOUND", status: "received" },
            });
            expect(mockAdvanceLeadAfterReply).toHaveBeenCalledWith(mockPrisma, { leadId: "lead-1", teamId: "team-1" });
        });

        it("matches a stored lead phone that includes a country-code prefix or punctuation", async () => {
            mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-2", teamId: "team-1" });
            const { POST } = await import("./route");

            const res = await POST(signedRequest(messagePayload({ from: "919876543210" })) as any);

            expect(res.status).toBe(200);
            expect(mockPrisma.whatsAppMessage.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ leadId: "lead-2" }) }));
        });

        it("skips silently (200 OK) when no team owns the phone_number_id", async () => {
            mockPrisma.team.findFirst.mockResolvedValue(null);
            const { POST } = await import("./route");

            const res = await POST(signedRequest(messagePayload()) as any);

            expect(res.status).toBe(200);
            expect(mockPrisma.whatsAppMessage.create).not.toHaveBeenCalled();
        });

        it("skips silently (200 OK) when no lead matches the sender's phone", async () => {
            mockPrisma.lead.findFirst.mockResolvedValue(null);
            const { POST } = await import("./route");

            const res = await POST(signedRequest(messagePayload()) as any);

            expect(res.status).toBe(200);
            expect(mockPrisma.whatsAppMessage.create).not.toHaveBeenCalled();
            expect(mockAdvanceLeadAfterReply).not.toHaveBeenCalled();
        });

        it("ignores non-message change events (e.g. a bare status-only field)", async () => {
            const { POST } = await import("./route");
            const payload = {
                entry: [{ id: "waba-1", changes: [{ field: "message_template_status_update", value: {} }] }],
            };

            const res = await POST(signedRequest(payload) as any);

            expect(res.status).toBe(200);
            expect(mockPrisma.team.findFirst).not.toHaveBeenCalled();
        });

        it("records a non-text message with a type placeholder body", async () => {
            const { POST } = await import("./route");
            const payload = {
                entry: [{
                    id: "waba-1",
                    changes: [{
                        field: "messages",
                        value: {
                            metadata: { phone_number_id: "phone-number-1" },
                            messages: [{ from: "919876543210", id: "wamid.2", type: "image" }],
                        },
                    }],
                }],
            };

            const res = await POST(signedRequest(payload) as any);

            expect(res.status).toBe(200);
            expect(mockPrisma.whatsAppMessage.create).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({ body: "[image message]" }),
            }));
        });

        it("returns 500 when processing throws unexpectedly, so Meta retries delivery", async () => {
            mockPrisma.team.findFirst.mockRejectedValue(new Error("db unavailable"));
            const { POST } = await import("./route");

            const res = await POST(signedRequest(messagePayload()) as any);

            expect(res.status).toBe(500);
        });
    });
});
