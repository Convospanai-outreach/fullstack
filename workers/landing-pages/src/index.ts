import { assignVariant } from "./abAssignment";

export interface Env {
	LANDING_PAGES: KVNamespace;
	API_ORIGIN: string;
	DEFAULT_HOST: string;
}

interface StoredPage {
	html: string;
	teamId: string;
	// sha256 CSP source of the page's one inline script, written by
	// cloudflarePagesService.ts. Absent on pages pushed before it existed.
	scriptHash?: string;
	// Set when the page loads its team's GA4/GTM/Hotjar (see tracking.ts in
	// apps/api); those loaders run inside the hashed script.
	tracking?: boolean;
	// Set when the page has a Meta Pixel; the policy then allows Meta's loader and beacon hosts.
	metaPixel?: boolean;
	// The lead form's success message, when the page has a form (written by cloudflarePagesService.ts).
	successMessage?: string;
	// The lead form's Instagram handle (written by cloudflarePagesService.ts, validated there and again in the worker).
	instagramHandle?: string;
}

// Clickjacking protection is enforced (nothing legitimately frames these pages).
// The rest of the policy ships Report-Only because customer HTML/CSS varies
// (external images, @import'd fonts): it only allows the page's own inline
// script by hash, so it can be switched to enforcing once reports are clean.
function securityHeaders(scriptHash?: string, tracking = false, metaPixel = false): Record<string, string> {
	return {
		"Content-Security-Policy": "frame-ancestors 'none'",
		"X-Frame-Options": "DENY",
		"Content-Security-Policy-Report-Only": [
			"default-src 'self'",
			// 'strict-dynamic' trusts the scripts the hashed loader adds, and only those.
			`script-src ${scriptHash ? `'${scriptHash}'${tracking ? " 'strict-dynamic'" : ""}${metaPixel ? " https://connect.facebook.net" : ""}` : "'none'"}`,
			"style-src 'self' 'unsafe-inline' https:",
			"img-src 'self' https: data:",
			"font-src 'self' https: data:",
			tracking ? `connect-src 'self' https: wss:${metaPixel ? " https://connect.facebook.net https://www.facebook.com" : ""}` : "connect-src 'self'",
			// Hotjar surveys and Tag Manager's preview open frames.
			...(tracking ? ["frame-src 'self' https:"] : []),
			"form-action 'self'",
			"base-uri 'none'",
			"object-src 'none'",
		].join("; "),
	};
}

function escapeText(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Same rule as the API's Instagram handle (leadFormConfig.ts): 1 to 30 letters, digits, dots or underscores.
const INSTAGRAM_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

// successMessage is the page's form success message, validated when the page was published.
function thankYouHtml(successMessage: string | undefined, instagramHandle: string | undefined): string {
	// The handle is put in an href, so it must match the pattern above; anything else gets no button.
	const follow = instagramHandle && INSTAGRAM_HANDLE_PATTERN.test(instagramHandle) ? `<p><a href="https://www.instagram.com/${instagramHandle}/" rel="noopener noreferrer">Follow us on Instagram</a></p>` : "";
	const message = successMessage ? escapeText(successMessage) : "Your submission has been received.";
	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Thank you</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:80px auto;text-align:center;color:#0f172a">
<h1>Thanks — we'll be in touch.</h1>
<p>${message}</p>
${follow}
</body></html>`;
}

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

// A/B test path (phase 6B): exp:<host>:<slug> routes a visitor to one of the test's two pages.
// Written by apps/api landingExperimentKv.ts. "test" assigns by weight with a sticky cookie; "fixed" serves one arm.
interface ExperimentEntry {
	experimentId: string;
	teamId: string;
	mode: "test" | "fixed";
	weightA?: number;
	fixedVariant?: "A" | "B";
	arms: { A: string; B: string };
}

async function serveExperiment(env: Env, request: Request, host: string, slug: string): Promise<Response> {
	const experiment = await env.LANDING_PAGES.get<ExperimentEntry>(`exp:${host}:${slug}`, "json");
	if (!experiment || !(await assertHostnameOwnsPage(env, host, { html: "", teamId: experiment.teamId }))) {
		return new Response("Not found", { status: 404 });
	}
	let variant: "A" | "B" = experiment.fixedVariant ?? "A";
	let setCookie: string | null = null;
	if (experiment.mode === "test") {
		const doNotTrack = request.headers.get("DNT") === "1" || request.headers.get("Sec-GPC") === "1";
		const assigned = assignVariant({
			experimentId: experiment.experimentId,
			cookieHeader: request.headers.get("Cookie"),
			weightA: experiment.weightA ?? 50,
			userAgent: request.headers.get("User-Agent"),
			doNotTrack,
			draw: Math.random(),
		});
		variant = assigned.variant;
		setCookie = assigned.setCookie;
	}
	const stored = await env.LANDING_PAGES.get<StoredPage>(`page:${experiment.arms[variant]}`, "json");
	if (!stored || !(await assertHostnameOwnsPage(env, host, stored))) {
		return new Response("Not found", { status: 404 });
	}
	// A test response depends on the cookie, so it must not be shared between visitors.
	const headers: Record<string, string> = {
		"Content-Type": "text/html; charset=utf-8",
		...securityHeaders(stored.scriptHash, stored.tracking === true, stored.metaPixel === true),
	};
	if (experiment.mode === "test") {
		headers["Cache-Control"] = "private, no-cache";
		headers["Vary"] = "Cookie";
		if (setCookie) headers["Set-Cookie"] = setCookie;
	} else {
		headers["Cache-Control"] = "public, max-age=60";
	}
	return new Response(stored.html, { headers });
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

		// A connected domain's root shows the page its team picked as the home page
		// (home:<hostname>, written from Settings -> Branding). Our own shared host
		// has no home page.
		const slug = segments[0] ?? (host === env.DEFAULT_HOST ? null : await env.LANDING_PAGES.get(`home:${host}`));

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
			const stored = await env.LANDING_PAGES.get<StoredPage>(`page:${slug}`, "json");
			const owned = stored ? await assertHostnameOwnsPage(env, host, stored) : false;
			return new Response(thankYouHtml(owned ? stored?.successMessage : undefined, owned ? stored?.instagramHandle : undefined), {
				headers: { "Content-Type": "text/html; charset=utf-8", ...securityHeaders() },
			});
		}

		if (request.method !== "GET") {
			return new Response("Method not allowed", { status: 405 });
		}

		const stored = await env.LANDING_PAGES.get<StoredPage>(`page:${slug}`, "json");
		if (!stored) {
			return serveExperiment(env, request, host, slug);
		}

		const allowed = await assertHostnameOwnsPage(env, host, stored);
		if (!allowed) {
			return new Response("Not found", { status: 404 });
		}

		return new Response(stored.html, {
			headers: {
				"Content-Type": "text/html; charset=utf-8",
				"Cache-Control": "public, max-age=60",
				...securityHeaders(stored.scriptHash, stored.tracking === true, stored.metaPixel === true),
			},
		});
	},
};
