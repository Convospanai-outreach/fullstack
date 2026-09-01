import type { OAuthConfig } from "next-auth/providers/oauth";
import { prisma } from "@/lib/db";
import { decryptClientSecret } from "./ssoSecrets";

export type ResolvedOidcSso = {
    teamId: string;
    allowedDomains: string[];
    provider: OAuthConfig<any>;
};

// NextAuth's `providers` array is normally static, but SsoConfiguration is per-team,
// so the real clientId/clientSecret/wellKnownUrl are resolved here at request time
// (from the [...nextauth] route handler) instead of at NextAuth() init.
export async function resolveOidcSsoForTeam(teamId: string): Promise<ResolvedOidcSso | null> {
    const config = await prisma.ssoConfiguration.findUnique({ where: { teamId } });
    if (!config || config.providerType !== "OIDC") return null;
    if (!config.clientId || !config.wellKnownUrl) return null;

    const clientSecret = decryptClientSecret(config.clientSecret);
    if (!clientSecret) return null;

    return {
        teamId: config.teamId,
        allowedDomains: config.allowedDomains.map((d) => d.toLowerCase()),
        provider: {
            id: "oidc",
            name: "SSO",
            type: "oauth",
            wellKnown: config.wellKnownUrl,
            clientId: config.clientId,
            clientSecret,
            checks: ["pkce", "state"],
            idToken: true,
            // Enterprise SSO trust model: the team admin proved control of the IdP by
            // configuring it, and allowedDomains scopes which emails that trust extends
            // to. The signIn guard (route.ts) re-verifies email_verified + domain + team
            // membership before this is allowed to link to an existing account.
            allowDangerousEmailAccountLinking: true,
            profile(profile: any) {
                return { id: profile.sub, name: profile.name ?? profile.email, email: profile.email };
            },
        },
    };
}

// Split out from the NextAuth signIn callback so the account-linking guards
// (email_verified, domain scoping, team membership) are unit-testable without
// going through NextAuth's OAuth callback machinery.
export async function isOidcSignInAllowed(params: {
    profile: any;
    email: string | null | undefined;
    allowedDomains: string[];
    teamId: string;
}): Promise<boolean> {
    if (params.profile?.email_verified !== true) return false;

    const email = params.email?.toLowerCase();
    const domain = email?.split("@")[1];
    if (!email || !domain || !params.allowedDomains.includes(domain)) return false;

    const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });
    if (!existingUser) return false;

    const membership = await prisma.teamMember.findFirst({
        where: { teamId: params.teamId, userId: existingUser.id, status: "active" },
        select: { id: true },
    });
    return Boolean(membership);
}
