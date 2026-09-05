import { NextRequest, NextResponse } from "next/server";
import { connectMicrosoftMailbox } from "@/modules/email-campaigner/service/microsoftMailboxService";
import { sanitizeRelativePath } from "@/modules/email-campaigner/service/googleMailboxService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  const baseUrl = process.env["NEXT_PUBLIC_APP_URL"] || "https://www.craftmyfunnel.live";
  const redirectTo = (path: string, params: Record<string, string>) => {
    const url = new URL(path, baseUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  };

  if (error || !code || !state) {
    const errMessage = errorDescription || error || (!state ? "Missing OAuth state." : "Microsoft OAuth authorization failed.");
    return NextResponse.redirect(redirectTo("/settings/mailboxes", { connected: "false", error: errMessage }), { status: 302 });
  }

  try {
    const result = await connectMicrosoftMailbox({ code, state });
    const targetPath = result.nextPath ? sanitizeRelativePath(result.nextPath) : "/settings/mailboxes";
    return NextResponse.redirect(
      redirectTo(targetPath, { connected: "true", email: result.mailbox.email, provider: "MICROSOFT_365" }),
      { status: 302 }
    );
  } catch (err: any) {
    return NextResponse.redirect(
      redirectTo("/settings/mailboxes", { connected: "false", error: err?.message || "Unexpected Microsoft OAuth error" }),
      { status: 302 }
    );
  }
}
