import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifySvixSignature } from "@/lib/webhooks/verifySvixSignature";

function sign(secret: string, svixId: string, svixTimestamp: string, rawBody: string): string {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const signature = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  return `v1,${signature}`;
}

describe("verifySvixSignature", () => {
  const secret = `whsec_${Buffer.from("test-secret-material").toString("base64")}`;
  const svixId = "msg_test123";
  const svixTimestamp = "1700000000";
  const rawBody = JSON.stringify({ type: "email.opened", data: { email_id: "abc" } });

  it("accepts a correctly signed payload", () => {
    const svixSignature = sign(secret, svixId, svixTimestamp, rawBody);
    expect(verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, rawBody })).toBe(true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    const wrongSecret = `whsec_${Buffer.from("different-secret").toString("base64")}`;
    const svixSignature = sign(wrongSecret, svixId, svixTimestamp, rawBody);
    expect(verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, rawBody })).toBe(false);
  });

  it("rejects a tampered body", () => {
    const svixSignature = sign(secret, svixId, svixTimestamp, rawBody);
    const tamperedBody = JSON.stringify({ type: "email.opened", data: { email_id: "hacked" } });
    expect(verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, rawBody: tamperedBody })).toBe(false);
  });

  it("accepts when the correct signature is one of several space-separated candidates", () => {
    const correct = sign(secret, svixId, svixTimestamp, rawBody);
    const svixSignature = `v1,bm90dGhlcmlnaHRvbmU= ${correct}`;
    expect(verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature, rawBody })).toBe(true);
  });

  it("rejects a malformed signature header without throwing", () => {
    expect(verifySvixSignature({ secret, svixId, svixTimestamp, svixSignature: "garbage", rawBody })).toBe(false);
  });
});
