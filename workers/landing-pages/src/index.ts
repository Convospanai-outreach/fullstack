export interface Env {
	LANDING_PAGES: KVNamespace;
	LANDING_ASSETS: R2Bucket;
	API_ORIGIN: string;
	DEFAULT_HOST: string;
	INTERNAL_UPLOAD_SECRET: string;
}

interface StoredPage {
	html: string;
	teamId: string;
}

const THANK_YOU_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Thank you</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:80px auto;text-align:center;color:#0f172a">
<h1>Thanks — we'll be in touch.</h1>
<p>Your submission has been received.</p>
</body></html>`;

// Isolation rule: our own shared fallback host may serve any team's slug (that's
// the default, unbranded hosting path). A verified custom hostname may only serve
// the slug belonging to the team that hostname was activated for - see the
// host:<hostname> KV entry written by the CustomDomain poll tick in
// apps/api/src/workers/worker-manager.ts once a domain goes "active".
async function assertHostnameOwnsPage(env: Env, host: string, page: StoredPage): Promise<boolean> {
	if (host === env.DEFAULT_HOST) return true;
	const ownerTeamId = await env.LANDING_PAGES.get(`host:${host}`);
	return ownerTeamId !== null && ownerTeamId === page.teamId;
}

async function proxyToApi(env: Env, request: Request, path: string): Promise<Response> {
	const upstream = new URL(path, env.API_ORIGIN);
	const clientIp = request.headers.get("CF-Connecting-IP");
	const headers = new Headers(request.headers);
	headers.delete("host");
	if (clientIp) headers.set("X-Forwarded-For", clientIp);

	return fetch(upstream, {
		method: request.method,
		headers,
		body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
	});
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const host = url.hostname;
		const segments = url.pathname.split("/").filter(Boolean);

		if (segments[0] === "assets" && segments[1] && request.method === "GET") {
			const key = segments.slice(1).join("/");
			const object = await env.LANDING_ASSETS.get(key);
			if (!object) {
				return new Response("Not found", { status: 404 });
			}
			const headers = new Headers();
			object.writeHttpMetadata(headers);
			headers.set("Cache-Control", "public, max-age=31536000, immutable");
			return new Response(object.body, { headers });
		}

		if (segments[0] === "internal" && segments[1] === "assets" && segments[2] && request.method === "POST") {
			const secret = request.headers.get("X-Internal-Secret");
			if (!secret || secret !== env.INTERNAL_UPLOAD_SECRET) {
				return new Response("Unauthorized", { status: 401 });
			}
			const key = segments.slice(2).join("/");
			const contentType = request.headers.get("Content-Type") || "application/octet-stream";
			await env.LANDING_ASSETS.put(key, request.body, { httpMetadata: { contentType } });
			return new Response(JSON.stringify({ ok: true, key }), {
				headers: { "Content-Type": "application/json" },
			});
		}

		const slug = segments[0];

		if (!slug) {
			return new Response("Not found", { status: 404 });
		}

		if (segments[1] === "lead" && request.method === "POST") {
			return proxyToApi(env, request, `/landing-agent/public/${slug}/lead`);
		}
		if (segments[1] === "event" && request.method === "POST") {
			return proxyToApi(env, request, `/landing-agent/public/${slug}/event`);
		}
		if (segments[1] === "thank-you" && request.method === "GET") {
			return new Response(THANK_YOU_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
		}

		if (request.method !== "GET") {
			return new Response("Method not allowed", { status: 405 });
		}

		const stored = await env.LANDING_PAGES.get<StoredPage>(`page:${slug}`, "json");
		if (!stored) {
			return new Response("Not found", { status: 404 });
		}

		const allowed = await assertHostnameOwnsPage(env, host, stored);
		if (!allowed) {
			return new Response("Not found", { status: 404 });
		}

		return new Response(stored.html, {
			headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60" },
		});
	},
};
