import { randomBytes } from "crypto";
import { canonicalOrigin } from "@/lib/decapCms";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    const clientId = process.env["CMS_GITHUB_CLIENT_ID"];
    if (!clientId || !process.env["CMS_GITHUB_CLIENT_SECRET"]) {
        return new Response("CMS login is not set up", { status: 503 });
    }

    const origin = canonicalOrigin(req.url);
    const state = randomBytes(16).toString("hex");
    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.searchParams.set("client_id", clientId);
    authorize.searchParams.set("redirect_uri", `${origin}/api/cms/callback`);
    // The site repo is public, so the narrowest scope is enough; the caller's own scope is ignored.
    authorize.searchParams.set("scope", "public_repo");
    authorize.searchParams.set("state", state);

    const secure = process.env["NODE_ENV"] === "production" ? "; Secure" : "";
    return new Response(null, {
        status: 302,
        headers: {
            location: authorize.toString(),
            "set-cookie": `cms_oauth_state=${state}; Path=/api/cms; HttpOnly; SameSite=Lax; Max-Age=600${secure}`,
            "cache-control": "no-store",
        },
    });
}
