import crypto from "crypto";

// Mirrors apps/web/src/lib/webhooks/verifySvixSignature.ts - see that file's header
// if this one needs updating too.
//
// Svix's own webhook libraries reject anything outside a 5-minute tolerance to
// prevent a captured, still-validly-signed payload from being replayed later.
// https://docs.svix.com/receiving/verifying-payloads/how-manual#verify-timestamp
const TOLERANCE_SECONDS = 5 * 60;

// Resend signs webhooks using the Svix format: https://docs.svix.com/receiving/verifying-payloads/how-manual
export function verifySvixSignature(params: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  rawBody: string;
}): boolean {
  const { secret, svixId, svixTimestamp, svixSignature, rawBody } = params;

  const timestampSeconds = Number(svixTimestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const nowSeconds = Date.now() / 1000;
  if (Math.abs(nowSeconds - timestampSeconds) > TOLERANCE_SECONDS) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expectedSignature = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  const providedSignatures = svixSignature.split(" ").map((part) => part.split(",")[1]).filter(Boolean) as string[];

  return providedSignatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  });
}
