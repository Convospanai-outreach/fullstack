import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    const parts = email.split("@");
    if (parts.length < 2) {
        return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }
    const domain = parts[1] as string;

    try {
        // Find SSO config where domain is allowed
        const ssoConfig = await prisma.ssoConfiguration.findFirst({
            where: {
                allowedDomains: {
                    has: domain
                }
            }
        });

        if (!ssoConfig) {
            return NextResponse.json({ sso: false });
        }

        // Generate redirect URL based on provider type
        // For SAML, we'd usually redirect to /api/auth/signin/saml?teamId=...
        // For OIDC, similar.

        let redirectUrl = "";
        if (ssoConfig.providerType === "SAML") {
            // This assumes we have a SAML provider configured in Auth.ts that handles teamId
            redirectUrl = `/api/auth/signin/saml?teamId=${ssoConfig.teamId}&login_hint=${encodeURIComponent(email)}`;
        } else {
            redirectUrl = `/api/auth/signin/oidc?teamId=${ssoConfig.teamId}&login_hint=${encodeURIComponent(email)}`;
        }

        return NextResponse.json({ sso: true, redirectUrl });
    } catch (error) {
        console.error("[SSO Check API] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
