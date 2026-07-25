import { describe, it, expect, vi, beforeEach } from "vitest";
import { MailProviderFactory, GoogleWorkspaceProvider, SmtpProvider, MicrosoftGraphProvider, MailProviderError } from "@/modules/email-campaigner/providers";

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

  describe("Provider Capabilities", () => {
    it("GoogleWorkspaceProvider supports native reply detection", () => {
      const provider = new GoogleWorkspaceProvider();
      expect(provider.supportsNativeReplyDetection()).toBe(true);
    });

    it("MicrosoftGraphProvider supports native reply detection", () => {
      const provider = new MicrosoftGraphProvider();
      expect(provider.supportsNativeReplyDetection()).toBe(true);
    });

    it("SmtpProvider requires IMAP polling (supportsNativeReplyDetection = false)", () => {
      const provider = new SmtpProvider();
      expect(provider.supportsNativeReplyDetection()).toBe(false);
    });
  });
});
