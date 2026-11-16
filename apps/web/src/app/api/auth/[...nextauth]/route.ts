import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveOidcSsoForTeam, resolveOidcSsoForEmail, isOidcSignInAllowed } from "@/lib/sso/oidc";
import { cookies } from "next/headers";

// Short-lived, since the IdP's registered redirect_uri has no room for a teamId
// query param - it carries the team across the signin -> callback hop instead.
const SSO_TEAM_COOKIE = "sso_pending_team";

type RouteContext = { params: Promise<{ nextauth: string[] }> };

async function optionsForRequest(req: Request, ctx: RouteContext) {
    const { nextauth } = await ctx.params;
    const [action, providerId] = nextauth ?? [];
    if (providerId !== "oidc") return { options: authOptions, teamId: null };

    // Signin finds the team from the email (login_hint); the team id is never in the URL.
    let resolved = null;
    if (action === "signin") {
        const email = new URL(req.url).searchParams.get("login_hint");
        resolved = email ? await resolveOidcSsoForEmail(email) : null;
    } else if (action === "callback") {
        const teamId = (await cookies()).get(SSO_TEAM_COOKIE)?.value;
        resolved = teamId ? await resolveOidcSsoForTeam(teamId) : null;
    }
    if (!resolved) return { options: authOptions, teamId: null };

    const options = {
        ...authOptions,
        providers: [resolved.provider],
        callbacks: {
            ...authOptions.callbacks,
            signIn: async (params: any) => {
                if (params.account?.provider !== "oidc") {
                    return authOptions.callbacks!.signIn!(params);
                }
                return isOidcSignInAllowed({
                    profile: params.profile,
                    email: params.user?.email,
                    allowedDomains: resolved.allowedDomains,
                    teamId: resolved.teamId,
                });
            },
        },
    };
    return { options, teamId: resolved.teamId };
}

async function handle(req: Request, ctx: RouteContext) {
    const { options, teamId } = await optionsForRequest(req, ctx);
    const response: Response = await (NextAuth as any)(req, ctx, options);

    const { nextauth } = await ctx.params;
    const [action, providerId] = nextauth ?? [];
    if (action === "signin" && providerId === "oidc") {
        if (teamId) {
            const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
            response.headers.append(
                "Set-Cookie",
                `${SSO_TEAM_COOKIE}=${encodeURIComponent(teamId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`
            );
        }
    }
    return response;
}

export { handle as GET, handle as POST };
