import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env["MICROSOFT_CLIENT_ID"];
  const redirectUri =
    process.env["MICROSOFT_REDIRECT_URI"] ||
    "https://www.craftmyfunnel.live/api/integrations/microsoft/oauth/callback";

  if (!clientId) {
    return NextResponse.json(
      { error: "MICROSOFT_CLIENT_ID is not configured in environment." },
      { status: 500 }
    );
  }

  const tenantId = req.nextUrl.searchParams.get("tenant") || "common";
  const state = req.nextUrl.searchParams.get("state") || "dashboard";

  const scope = encodeURIComponent("offline_access Mail.Send openid profile");
  const authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_mode=query&scope=${scope}&state=${state}`;

  return NextResponse.redirect(authUrl, { status: 302 });
}
