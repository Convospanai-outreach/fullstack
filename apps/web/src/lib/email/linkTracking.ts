import crypto from "crypto";

function getAppBaseUrl(): string {
  return (process.env["NEXTAUTH_URL"] || process.env["APP_URL"] || "http://localhost:3000").replace(/\/$/, "");
}

export function buildOpenPixelHtml(trackingId: string): string {
  const url = `${getAppBaseUrl()}/api/track/open/${trackingId}`;
  return `<img src="${url}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />`;
}

const HREF_PATTERN = /(<a\s+(?:[^>]*?\s)?href=)(["'])(.*?)\2/gi;

export interface LinkRewriteContext {
  teamId: string;
  emailId: string;
  mailboxId?: string | null;
  campaignId?: string | null;
  leadId?: string | null;
}

export async function rewriteLinksForTracking(html: string, ctx: LinkRewriteContext): Promise<string> {
  const { prisma } = await import("@/lib/db");
  const baseUrl = getAppBaseUrl();

  const replacements: { start: number; end: number; url: string }[] = [];
  let m: RegExpExecArray | null;
  HREF_PATTERN.lastIndex = 0;
  while ((m = HREF_PATTERN.exec(html)) !== null) {
    const url = m[3] as string;
    if (!/^https?:\/\//i.test(url)) continue; // skip mailto:, tel:, javascript:, anchors
    const urlStart = m.index + (m[1] as string).length + (m[2] as string).length;
    replacements.push({ start: urlStart, end: urlStart + url.length, url });
  }

  if (replacements.length === 0) return html;

  for (const r of replacements) {
    const trackingKey = crypto.randomUUID();
    await prisma.trackedLink.create({
      data: {
        teamId: ctx.teamId,
        emailId: ctx.emailId,
        mailboxId: ctx.mailboxId || null,
        campaignId: ctx.campaignId || null,
        leadId: ctx.leadId || null,
        trackingKey,
        destinationUrl: r.url,
      },
    });
    (r as any).trackedUrl = `${baseUrl}/api/track/click/${trackingKey}`;
  }

  // Apply replacements from the end so earlier offsets stay valid
  let result = html;
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i] as { start: number; end: number; url: string; trackedUrl: string };
    result = result.slice(0, r.start) + r.trackedUrl + result.slice(r.end);
  }

  return result;
}
