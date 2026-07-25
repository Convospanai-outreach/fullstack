import { NextRequest, NextResponse } from "next/server";
import { encryptCredential } from "@/lib/security/credentialVault";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");

  const baseUrl = process.env["NEXT_PUBLIC_APP_URL"] || "https://www.craftmyfunnel.live";

  if (error || !code) {
    const errMessage = encodeURIComponent(errorDescription || error || "Microsoft OAuth authorization failed.");
    return NextResponse.redirect(`${baseUrl}/settings/mailboxes?connected=false&error=${errMessage}`, { status: 302 });
  }

  const clientId = process.env["MICROSOFT_CLIENT_ID"];
  const clientSecret = process.env["MICROSOFT_CLIENT_SECRET"];
  const redirectUri =
    process.env["MICROSOFT_REDIRECT_URI"] ||
    "https://www.craftmyfunnel.live/api/integrations/microsoft/oauth/callback";

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${baseUrl}/settings/mailboxes?connected=false&error=Microsoft+OAuth+credentials+not+configured`, { status: 302 });
  }

  try {
    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        scope: "offline_access Mail.Send openid profile",
      }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (!tokenRes.ok) {
      const msg = encodeURIComponent(tokenData.error_description || tokenData.error || "Failed to exchange Microsoft token.");
      return NextResponse.redirect(`${baseUrl}/settings/mailboxes?connected=false&error=${msg}`, { status: 302 });
    }

    // Fetch user profile email
    const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const meData = (await meRes.json()) as any;
    const email = (meData.mail || meData.userPrincipalName || "").toLowerCase().trim();

    if (!email) {
      return NextResponse.redirect(`${baseUrl}/settings/mailboxes?connected=false&error=Failed+to+retrieve+Microsoft+user+email`, { status: 302 });
    }

    const { prisma } = await import("@/lib/db");

    // Fetch or create team
    const team = await prisma.team.findFirst({ select: { id: true } });
    if (!team) {
      return NextResponse.redirect(`${baseUrl}/settings/mailboxes?connected=false&error=No+active+workspace+team+found`, { status: 302 });
    }

    const encryptedAccessToken = await encryptCredential(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token ? await encryptCredential(tokenData.refresh_token) : null;
    const tokenExpiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;

    await prisma.connectedMailbox.upsert({
      where: { teamId_email: { teamId: team.id, email } },
      create: {
        teamId: team.id,
        provider: "MICROSOFT_365",
        authType: "OAUTH",
        email,
        displayName: meData.displayName || email,
        status: "CONNECTED",
        encryptedAccessToken: encryptedAccessToken as any,
        ...(encryptedRefreshToken ? { encryptedRefreshToken: encryptedRefreshToken as any } : {}),
        tokenExpiresAt,
        dailyLimit: 50,
        minDelaySeconds: 180,
      },
      update: {
        status: "CONNECTED",
        encryptedAccessToken: encryptedAccessToken as any,
        ...(encryptedRefreshToken ? { encryptedRefreshToken: encryptedRefreshToken as any } : {}),
        tokenExpiresAt,
        updatedAt: new Date(),
      },
    });

    return NextResponse.redirect(`${baseUrl}/settings/mailboxes?connected=true&email=${encodeURIComponent(email)}&provider=MICROSOFT_365`, { status: 302 });
  } catch (err: any) {
    const errStr = encodeURIComponent(err?.message || "Unexpected Microsoft OAuth error");
    return NextResponse.redirect(`${baseUrl}/settings/mailboxes?connected=false&error=${errStr}`, { status: 302 });
  }
}
