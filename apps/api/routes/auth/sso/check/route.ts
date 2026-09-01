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

        if (ssoConfig.providerType === "SAML") {
            // SAML login is not implemented - only OIDC is wired up end-to-end.
            return NextResponse.json({
                sso: true,
                error: "SAML sign-in is not supported yet. Please use password login or ask your admin to configure OIDC.",
            });
        }

        return NextResponse.json({ sso: true, provider: "OIDC", teamId: ssoConfig.teamId });
    } catch (error) {
        console.error("[SSO Check API] error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
