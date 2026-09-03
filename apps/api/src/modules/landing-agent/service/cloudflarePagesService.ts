import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getLandingRenderPayload } from "../rendering";

// Pushes a published landing page's HTML into the Cloudflare Worker's KV store
// (workers/landing-pages) so it can be served directly from Cloudflare's edge -
// this app stays the single source of truth for content (LandingPage.renderedJson);
// Cloudflare is purely the serving layer. One-way push only, mirroring
// mauticService.ts's shape: a no-op when Cloudflare env vars aren't configured,
// errors caught and logged rather than thrown into the publish flow.

export interface CloudflarePushResult {
    status: "pushed" | "skipped" | "error";
    details?: string;
}

function getCloudflareConfig() {
    const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
    const namespaceId = process.env["CLOUDFLARE_KV_NAMESPACE_ID"];
    if (!accountId || !apiToken || !namespaceId) return null;
    return { accountId, apiToken, namespaceId };
}

// Vanilla-JS port of PublishedLandingRenderer.tsx's tracking/submit logic (page_view
// on load, form_start on first field focus, POST to /:slug/lead on submit, cta_click
// + redirect to /:slug/thank-you on success) - keep behavior identical to that
// component, this isn't a redesign.
function buildLeadFormScript(slug: string): string {
    return `
<script>
(function () {
  var slug = ${JSON.stringify(slug)};
  var sessionId = (crypto.randomUUID ? crypto.randomUUID() : "sess-" + Date.now() + "-" + Math.random().toString(36).slice(2));
  var version = ${Date.now()};
  var formStarted = false;

  function trackEvent(eventName, eventData) {
    fetch("/" + slug + "/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventName: eventName, sessionId: sessionId, pageVersion: version, eventData: eventData || undefined }),
    }).catch(function () {});
  }

  trackEvent("page_view", { path: location.pathname });

  var form = document.getElementById("la-lead-form");
  if (!form) return;

  form.addEventListener("focusin", function () {
    if (formStarted) return;
    formStarted = true;
    trackEvent("form_start");
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var statusEl = document.getElementById("la-lead-form-status");
    var submitBtn = form.querySelector("button[type=submit]");
    if (submitBtn) submitBtn.disabled = true;
    if (statusEl) statusEl.textContent = "";

    var data = new FormData(form);
    var url = new URL(location.href);
    fetch("/" + slug + "/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sessionId,
        pageVersion: version,
        name: data.get("name") || undefined,
        email: data.get("email") || undefined,
        phone: data.get("phone") || undefined,
        company: data.get("company") || undefined,
        title: data.get("title") || undefined,
        website: data.get("website") || undefined,
        utmSource: url.searchParams.get("utm_source") || undefined,
        utmMedium: url.searchParams.get("utm_medium") || undefined,
        utmCampaign: url.searchParams.get("utm_campaign") || undefined,
        utmTerm: url.searchParams.get("utm_term") || undefined,
        utmContent: url.searchParams.get("utm_content") || undefined,
        referrer: document.referrer || undefined,
      }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Submission failed");
        trackEvent("cta_click", { cta: "form_submit" });
        location.href = "/" + slug + "/thank-you";
      })
      .catch(function () {
        if (statusEl) statusEl.textContent = "Submission failed. Please try again.";
        if (submitBtn) submitBtn.disabled = false;
      });
  });
})();
</script>`;
}

function buildLeadFormMarkup(): string {
    return `
<section class="la-section" style="max-width:640px;margin:40px auto">
    <span id="lead-form"></span>
    <h2>Request a follow-up</h2>
    <p>Share details and our team will reach out shortly.</p>
    <form id="la-lead-form" style="display:grid;gap:12px;margin-top:16px">
        <input type="text" name="name" placeholder="Name" />
        <input type="email" name="email" placeholder="Work email" required />
        <input type="text" name="phone" placeholder="Phone" />
        <input type="text" name="company" placeholder="Company" />
        <input type="text" name="title" placeholder="Title" />
        <input type="text" name="website" tabindex="-1" autocomplete="off" style="display:none" />
        <button type="submit" class="la-cta">Submit</button>
    </form>
    <p id="la-lead-form-status" style="color:#e11d48;font-size:14px"></p>
</section>`;
}

function buildFullDocument(input: { title?: string | null; css: string; html: string; slug: string }): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${(input.title || "Landing Page").replace(/</g, "&lt;")}</title>
<style>${input.css}</style>
</head>
<body class="la-page">
${input.html}
${buildLeadFormMarkup()}
${buildLeadFormScript(input.slug)}
</body>
</html>`;
}

class CloudflarePagesService {
    async publishPageToCloudflare(pageId: string): Promise<CloudflarePushResult> {
        const config = getCloudflareConfig();
        if (!config) {
            return { status: "skipped", details: "Cloudflare is not configured (CLOUDFLARE_ACCOUNT_ID/API_TOKEN/KV_NAMESPACE_ID missing)" };
        }

        try {
            const page = await prisma.landingPage.findUnique({
                where: { id: pageId },
                include: { campaign: { select: { teamId: true } } },
            });
            if (!page || !page.slug) {
                return { status: "error", details: "Landing page not found or missing a slug" };
            }

            const payload = getLandingRenderPayload(page.renderedJson);
            const html = buildFullDocument({ title: page.title, css: payload.css, html: payload.html, slug: page.slug });

            const res = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/page:${encodeURIComponent(page.slug)}`,
                {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ html, teamId: page.campaign.teamId }),
                }
            );

            if (!res.ok) {
                throw new Error(`Cloudflare KV write failed: ${res.status} ${await res.text()}`);
            }

            return { status: "pushed" };
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            logger.error(`[CloudflarePagesService] publishPageToCloudflare error for page ${pageId}:`, { error: message });
            return { status: "error", details: message };
        }
    }
}

export const cloudflarePagesService = new CloudflarePagesService();
