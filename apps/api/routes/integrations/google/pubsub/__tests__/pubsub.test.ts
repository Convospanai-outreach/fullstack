import { vi, describe, it, expect, beforeEach, afterEach, Mock } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../route";
import { handleGooglePubSubNotification } from "@/modules/email-campaigner/service/googleMailboxService";

// Mock the pubsub handler service function
vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({
    handleGooglePubSubNotification: vi.fn(),
}));

const mockVerifyIdToken = vi.fn();

// Mock google-auth-library
vi.mock("google-auth-library", () => {
    return {
        OAuth2Client: class {
            verifyIdToken = mockVerifyIdToken;
        },
    };
});

function createRequest(options: {
    headers?: Record<string, string>;
    body?: any;
    query?: string;
}) {
    const url = `http://localhost:3001/api/integrations/google/pubsub${options.query || ""}`;
    return new NextRequest(url, {
        method: "POST",
        headers: options.headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
}

describe("Pub/Sub OIDC Push route", () => {
    const requiredServiceAccount = "gmail-pubsub-push@helical-sanctum-496213-p8.iam.gserviceaccount.com";
    const defaultAudience = "https://app-audience";

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("GMAIL_PUBSUB_AUDIENCE", defaultAudience);
        vi.stubEnv("GMAIL_PUBSUB_SERVICE_ACCOUNT", requiredServiceAccount);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("OIDC Authentication Gates", () => {
        it("should call verifyIdToken with token and configuredAudience", async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                getPayload: () => ({
                    iss: "accounts.google.com",
                    email_verified: true,
                    email: requiredServiceAccount,
                }),
            });
            (handleGooglePubSubNotification as Mock).mockResolvedValueOnce({ accepted: true });

            const payload = JSON.stringify({ emailAddress: "test@gmail.com", historyId: "123" });
            const data = Buffer.from(payload).toString("base64url");

            const req = createRequest({
                headers: { Authorization: "Bearer my-token-123" },
                body: { message: { messageId: "msg-123", data } },
            });
            await POST(req);

            expect(mockVerifyIdToken).toHaveBeenCalledWith({
                idToken: "my-token-123",
                audience: defaultAudience,
            });
        });

        it("should reject with 401 if wrong audience", async () => {
            mockVerifyIdToken.mockRejectedValueOnce(new Error("Wrong recipient"));
            const req = createRequest({ headers: { Authorization: "Bearer wrong-aud-token" } });
            const res = await POST(req);
            expect(res.status).toBe(401);
            expect(await res.json()).toEqual({ error: "Unauthorized" });
        });

        it("should reject with 401 if expired token", async () => {
            mockVerifyIdToken.mockRejectedValueOnce(new Error("Token expired"));
            const req = createRequest({ headers: { Authorization: "Bearer expired-token" } });
            const res = await POST(req);
            expect(res.status).toBe(401);
        });

        it("should reject with 401 if empty payload", async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                getPayload: () => null,
            });
            const req = createRequest({ headers: { Authorization: "Bearer empty-token" } });
            const res = await POST(req);
            expect(res.status).toBe(401);
        });

        it("should not authenticate using GOOGLE_PUBSUB_VERIFICATION_TOKEN static token", async () => {
            vi.stubEnv("GOOGLE_PUBSUB_VERIFICATION_TOKEN", "static-token-123");
            const req = createRequest({ headers: { Authorization: "Bearer static-token-123" } });
            mockVerifyIdToken.mockRejectedValueOnce(new Error("Invalid token"));
            const res = await POST(req);
            expect(res.status).toBe(401);
        });

        it("should not authenticate using query token (?token=)", async () => {
            const req = createRequest({ query: "?token=valid-token" });
            const res = await POST(req);
            expect(res.status).toBe(401);
        });

        it("should not authenticate using x-google-pubsub-token header", async () => {
            const req = createRequest({ headers: { "x-google-pubsub-token": "valid-token" } });
            const res = await POST(req);
            expect(res.status).toBe(401);
        });

        it("should not authenticate using x-goog-channel-token header", async () => {
            const req = createRequest({ headers: { "x-goog-channel-token": "valid-token" } });
            const res = await POST(req);
            expect(res.status).toBe(401);
        });

        it("should succeed and proceed with valid signed identity", async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                getPayload: () => ({
                    iss: "accounts.google.com",
                    email_verified: true,
                    email: requiredServiceAccount,
                }),
            });
            (handleGooglePubSubNotification as Mock).mockResolvedValueOnce({ accepted: true });

            const payload = JSON.stringify({ emailAddress: "test@gmail.com", historyId: "123" });
            const data = Buffer.from(payload).toString("base64url");

            const req = createRequest({
                headers: { Authorization: "Bearer good-token" },
                body: { message: { messageId: "msg-1", data } },
            });
            const res = await POST(req);
            expect(res.status).toBe(200);
        });

        it("should reject with 401 if service account email does not match", async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                getPayload: () => ({
                    iss: "accounts.google.com",
                    email_verified: true,
                    email: "wrong-service-account@google.com",
                }),
            });
            const req = createRequest({ headers: { Authorization: "Bearer wrong-email-token" } });
            const res = await POST(req);
            expect(res.status).toBe(401);
            expect(await res.json()).toEqual({ error: "Unauthorized" });
        });
    });

    describe("Payload Structure & Validation Checks", () => {
        function mockValidToken() {
            mockVerifyIdToken.mockResolvedValueOnce({
                getPayload: () => ({
                    iss: "accounts.google.com",
                    email_verified: true,
                    email: requiredServiceAccount,
                }),
            });
        }

        it("should return 400 if data string is empty", async () => {
            mockValidToken();
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data: "" } },
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should return 400 if data string has whitespace", async () => {
            mockValidToken();
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data: "aGVs bG8" } },
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
            expect(handleGooglePubSubNotification).not.toHaveBeenCalled();
        });

        it("should return 400 if data string has invalid Base64URL character (+)", async () => {
            mockValidToken();
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data: "aGVsbG8+" } },
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should return 400 if data string length modulo four equals one", async () => {
            mockValidToken();
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data: "a" } }, // length 1 % 4 = 1
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should return 400 if data string has invalid padding placement (=)", async () => {
            mockValidToken();
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data: "aGVsbG8=" } }, // padding not allowed in base64url
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should succeed with valid unpadded Base64URL", async () => {
            mockValidToken();
            (handleGooglePubSubNotification as Mock).mockResolvedValueOnce({ accepted: true });
            const payload = JSON.stringify({ emailAddress: "test@gmail.com", historyId: "123" });
            const data = Buffer.from(payload).toString("base64url"); // unpadded

            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data } },
            });
            const res = await POST(req);
            expect(res.status).toBe(200);
        });

        it("should return 400 if invalid UTF-8 sequence is decoded", async () => {
            mockValidToken();
            // 0xFF 0xFE invalid UTF-8 -> "__4" in base64url
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data: "__4" } },
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should return 400 if malformed decoded JSON", async () => {
            mockValidToken();
            // "not-json" in base64url is "bm90LWpzb24"
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data: "bm90LWpzb24" } },
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should return 400 if decoded JSON is array instead of object", async () => {
            mockValidToken();
            // "[]" in base64url is "W10"
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data: "W10" } },
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should return 400 if empty emailAddress", async () => {
            mockValidToken();
            const data = Buffer.from(JSON.stringify({ emailAddress: "", historyId: "123" })).toString("base64url");
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data } },
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should return 400 if malformed emailAddress", async () => {
            mockValidToken();
            const data = Buffer.from(JSON.stringify({ emailAddress: "bademail", historyId: "123" })).toString("base64url");
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data } },
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should return 400 if missing historyId", async () => {
            mockValidToken();
            const data = Buffer.from(JSON.stringify({ emailAddress: "test@gmail.com" })).toString("base64url");
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data } },
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should return 400 if empty historyId", async () => {
            mockValidToken();
            const data = Buffer.from(JSON.stringify({ emailAddress: "test@gmail.com", historyId: "" })).toString("base64url");
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data } },
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should return 400 if non-string historyId", async () => {
            mockValidToken();
            const data = Buffer.from(JSON.stringify({ emailAddress: "test@gmail.com", historyId: 12345 })).toString("base64url");
            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data } },
            });
            const res = await POST(req);
            expect(res.status).toBe(400);
        });

        it("should pass messageId correctly to the service function", async () => {
            mockValidToken();
            (handleGooglePubSubNotification as Mock).mockResolvedValueOnce({ accepted: true });

            const payload = JSON.stringify({ emailAddress: "test@gmail.com", historyId: "123" });
            const data = Buffer.from(payload).toString("base64url");

            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { messageId: "msg-12345", data } },
            });
            await POST(req);

            expect(handleGooglePubSubNotification).toHaveBeenCalledWith(
                expect.objectContaining({
                    messageId: "msg-12345",
                    data,
                })
            );
        });

        it("should return 500 if handleGooglePubSubNotification returns accepted: false with reason PROCESSING_FAILURE", async () => {
            mockValidToken();
            (handleGooglePubSubNotification as Mock).mockResolvedValueOnce({
                accepted: false,
                reason: "PROCESSING_FAILURE",
                error: "Sensitive internal database query timed out",
            });

            const payload = JSON.stringify({ emailAddress: "test@gmail.com", historyId: "123" });
            const data = Buffer.from(payload).toString("base64url");

            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data } },
            });
            const res = await POST(req);
            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body).toEqual({
                error: "Internal processing error.",
                reason: "PROCESSING_FAILURE",
            });
            expect(JSON.stringify(body)).not.toContain("Sensitive");
        });

        it("should return 500 if handleGooglePubSubNotification throws an error", async () => {
            mockValidToken();
            (handleGooglePubSubNotification as Mock).mockRejectedValueOnce(new Error("Critical file system failure"));

            const payload = JSON.stringify({ emailAddress: "test@gmail.com", historyId: "123" });
            const data = Buffer.from(payload).toString("base64url");

            const req = createRequest({
                headers: { Authorization: "Bearer token" },
                body: { message: { data } },
            });
            const res = await POST(req);
            expect(res.status).toBe(500);
            const body = await res.json();
            expect(body).toEqual({
                error: "Internal processing error.",
                reason: "PROCESSING_FAILURE",
            });
            expect(JSON.stringify(body)).not.toContain("Critical");
        });
    });
});
