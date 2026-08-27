import { describe, it, expect, vi, beforeEach } from "vitest";
import { MailProviderFactory, GoogleWorkspaceProvider, SmtpProvider, MicrosoftGraphProvider, ResendProvider, MailProviderError } from "@/modules/email-campaigner/providers";

const resendSendMock = vi.fn();
const resendApiKeysListMock = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resendSendMock };
    apiKeys = { list: resendApiKeysListMock };
  },
}));

describe("MailProvider Architecture & Provider Implementations", () => {
  beforeEach(() => {
    process.env["ENCRYPTION_KEY"] = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    process.env["MICROSOFT_CLIENT_ID"] = "test-ms-client-id";
    process.env["MICROSOFT_CLIENT_SECRET"] = "test-ms-client-secret";
  });

  describe("MailProviderFactory Registry", () => {
    it("registers and retrieves GOOGLE_WORKSPACE provider", () => {
      const provider = MailProviderFactory.getProvider("GOOGLE_WORKSPACE");
      expect(provider).toBeInstanceOf(GoogleWorkspaceProvider);
      expect(provider.providerKey).toBe("GOOGLE_WORKSPACE");
    });

    it("registers and retrieves SMTP provider", () => {
      const provider = MailProviderFactory.getProvider("SMTP");
      expect(provider).toBeInstanceOf(SmtpProvider);
      expect(provider.providerKey).toBe("SMTP");
    });

    it("registers and retrieves MICROSOFT_365 provider", () => {
      const provider = MailProviderFactory.getProvider("MICROSOFT_365");
      expect(provider).toBeInstanceOf(MicrosoftGraphProvider);
      expect(provider.providerKey).toBe("MICROSOFT_365");
    });

    it("registers and retrieves RESEND provider", () => {
      const provider = MailProviderFactory.getProvider("RESEND");
      expect(provider).toBeInstanceOf(ResendProvider);
      expect(provider.providerKey).toBe("RESEND");
    });

    it("throws clear error on unregistered provider key", () => {
      expect(() => MailProviderFactory.getProvider("INVALID_PROVIDER" as any)).toThrow(
        'No MailProvider registered for provider key "INVALID_PROVIDER"'
      );
    });
  });

  describe("MailProviderError Classification", () => {
    it("instantiates MailProviderError with typed kind and retryable flag", () => {
      const err = new MailProviderError("Auth token expired", "AUTH_EXPIRED", true);
      expect(err.kind).toBe("AUTH_EXPIRED");
      expect(err.retryable).toBe(true);
      expect(err.message).toBe("Auth token expired");
    });
  });

  describe("GoogleWorkspaceProvider Verification", () => {
    const provider = new GoogleWorkspaceProvider();

    it("verifies CONNECTED mailbox status", async () => {
      const result = await provider.verifyConnection({ status: "CONNECTED" });
      expect(result.ok).toBe(true);
    });

    it("returns error for DISCONNECTED mailbox status", async () => {
      const result = await provider.verifyConnection({ status: "DISCONNECTED" });
      expect(result.ok).toBe(false);
      expect(result.error).toContain("CONNECTED");
    });
  });

  describe("SmtpProvider Verification & Send", () => {
    const provider = new SmtpProvider();

    it("handles SmtpProvider verifyConnection gracefully on invalid host", async () => {
      const result = await provider.verifyConnection({
        email: "sender@example.com",
        displayName: "Sender Name",
        metadata: { host: "invalid.smtp.host", port: 587 },
      });
      expect(result.ok).toBe(false);
    }, 15000);

    it("handles SmtpProvider send failure gracefully", async () => {
      const mailbox = {
        email: "sender@example.com",
        displayName: "Sender Name",
        metadata: { host: "invalid.smtp.host", port: 587 },
      };
      await expect(
        provider.send(mailbox, {
          to: "prospect@example.com",
          from: "sender@example.com",
          subject: "Test Subject",
          html: "<p>Test</p>",
          text: "Test",
        })
      ).rejects.toThrow(MailProviderError);
    }, 15000);
  });

  describe("MicrosoftGraphProvider Verification", () => {
    const provider = new MicrosoftGraphProvider();

    it("fails verifyConnection if token missing", async () => {
      const result = await provider.verifyConnection({
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("ResendProvider Verification & Send", () => {
    const provider = new ResendProvider();

    beforeEach(() => {
      resendSendMock.mockReset();
      resendApiKeysListMock.mockReset();
    });

    it("fails verifyConnection if API key missing", async () => {
      const result = await provider.verifyConnection({
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
      });
      expect(result.ok).toBe(false);
    });

    it("fails verifyConnection when Resend rejects the key", async () => {
      resendApiKeysListMock.mockResolvedValue({ data: null, error: { message: "Invalid API key" } });
      const { encryptCredential } = await import("@/lib/security/credentialVault");
      const mailbox = { encryptedAccessToken: await encryptCredential("re_bad_key") };
      const result = await provider.verifyConnection(mailbox);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Invalid API key");
    });

    it("succeeds verifyConnection when Resend accepts the key", async () => {
      resendApiKeysListMock.mockResolvedValue({ data: [], error: null });
      const { encryptCredential } = await import("@/lib/security/credentialVault");
      const mailbox = { encryptedAccessToken: await encryptCredential("re_good_key") };
      const result = await provider.verifyConnection(mailbox);
      expect(result.ok).toBe(true);
    });

    it("classifies invalid_api_key send errors as AUTH_EXPIRED", async () => {
      resendSendMock.mockResolvedValue({ data: null, error: { name: "invalid_api_key", message: "API key is invalid" } });
      const { encryptCredential } = await import("@/lib/security/credentialVault");
      const mailbox = { email: "sender@example.com", displayName: "Sender", encryptedAccessToken: await encryptCredential("re_bad_key") };
      try {
        await provider.send(mailbox, { to: "prospect@example.com", from: "sender@example.com", subject: "Test", html: "<p>Test</p>", text: "Test" });
        expect.unreachable("send should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(MailProviderError);
        expect((err as MailProviderError).kind).toBe("AUTH_EXPIRED");
      }
    });

    it("returns providerMessageId on successful send", async () => {
      resendSendMock.mockResolvedValue({ data: { id: "resend-msg-123" }, error: null });
      const { encryptCredential } = await import("@/lib/security/credentialVault");
      const mailbox = { email: "sender@example.com", displayName: "Sender", encryptedAccessToken: await encryptCredential("re_good_key") };
      const result = await provider.send(mailbox, { to: "prospect@example.com", from: "sender@example.com", subject: "Test", html: "<p>Test</p>", text: "Test" });
      expect(result.providerMessageId).toBe("resend-msg-123");
    });
  });
});
