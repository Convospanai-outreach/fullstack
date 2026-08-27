import crypto from "crypto";

// Resend signs webhooks using the Svix format: https://docs.svix.com/receiving/verifying-payloads/how-manual
export function verifySvixSignature(params: {
  secret: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  rawBody: string;
}): boolean {
  const { secret, svixId, svixTimestamp, svixSignature, rawBody } = params;
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
