function getAppBaseUrl(): string {
  return (process.env["NEXTAUTH_URL"] || process.env["APP_URL"] || "http://localhost:3000").replace(/\/$/, "");
}

export function buildUnsubscribeUrl(trackingId: string): string {
  return `${getAppBaseUrl()}/api/email/unsubscribe/${trackingId}`;
}

export function buildUnsubscribeHeaders(trackingId: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${buildUnsubscribeUrl(trackingId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// postalAddress: the team's mailing address, required in commercial email. Left out when the team has none.
export function appendUnsubscribeFooter(html: string, trackingId: string, postalAddress?: string | null): string {
  const address = postalAddress?.trim();
  const addressLine = address ? ` ${escapeHtml(address)}` : "";
  const footer = `<p style="font-size:11px;color:#94a3b8;margin-top:24px;">If you'd rather not hear from us again, <a href="${buildUnsubscribeUrl(trackingId)}" style="color:#94a3b8;">unsubscribe here</a>.${addressLine}</p>`;
  return `${html}${footer}`;
}
