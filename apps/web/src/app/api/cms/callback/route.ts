import { timingSafeEqual } from "crypto";
import { canonicalOrigin } from "@/lib/decapCms";

export const dynamic = "force-dynamic";

const CLEAR_STATE = "cms_oauth_state=; Path=/api/cms; HttpOnly; SameSite=Lax; Max-Age=0";

function readCookie(header: string | null, name: string): string {
    for (const part of (header ?? "").split(";")) {
        const [key, ...value] = part.trim().split("=");
        if (key === name) return value.join("=");
    }
    return "";
}

function sameState(a: string, b: string): boolean {
    return a.length > 0 && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Hands the result to the admin page that opened this window, which only accepts it from this site's own
// origin. `<` is escaped so the token cannot close the script tag.
function handoff(origin: string, status: "success" | "error", payload: object): Response {
    const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
    const literal = (value: string) => JSON.stringify(value).replace(/</g, `${String.fromCharCode(92)}u003c`);
    const html = `<!doctype html><html><body><script>
(function () {
  var ORIGIN = ${literal(origin)};
  var MESSAGE = ${literal(message)};
  function receive(e) {
    if (e.origin !== ORIGIN) return;
    window.opener.postMessage(MESSAGE, e.origin);
    window.removeEventListener("message", receive, false);
  }
  window.addEventListener("message", receive, false);
  window.opener.postMessage("authorizing:github", ORIGIN);
})();
</script></body></html>`;
    return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "set-cookie": CLEAR_STATE },
    });
}

export async function GET(req: Request) {
    const clientId = process.env["CMS_GITHUB_CLIENT_ID"];
    const clientSecret = process.env["CMS_GITHUB_CLIENT_SECRET"];
    if (!clientId || !clientSecret) return new Response("CMS login is not set up", { status: 503 });

    const url = new URL(req.url);
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    if (!code || !sameState(state, readCookie(req.headers.get("cookie"), "cms_oauth_state"))) {
        return new Response("Login could not be verified. Start again from /cms.", {
            status: 400,
            headers: { "set-cookie": CLEAR_STATE, "cache-control": "no-store" },
        });
    }

    const origin = canonicalOrigin(req.url);
    try {
        const res = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: `${origin}/api/cms/callback`,
            }),
        });
        const data = (await res.json()) as { access_token?: string };
        if (!data.access_token) return handoff(origin, "error", { message: "GitHub did not accept the login" });
        return handoff(origin, "success", { token: data.access_token, provider: "github" });
    } catch {
        return handoff(origin, "error", { message: "Could not reach GitHub" });
    }
}
