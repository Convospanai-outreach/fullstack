import { assertSafeWebhookUrl } from "@/modules/webhooks/service/webhookService";

// Schemes that carry their data inline and never reach the network.
const INLINE_SCHEMES = /^(data|blob|about):/i;

type InterceptablePage = {
    setRequestInterception(enabled: boolean): Promise<void>;
    on(event: "request", handler: (request: InterceptedRequest) => void): unknown;
    goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
};

type InterceptedRequest = {
    url(): string;
    continue(): Promise<void> | void;
    abort(reason?: string): Promise<void> | void;
};

/**
 * Navigates a browser page to a user-supplied URL without letting it reach internal addresses (SSRF).
 *
 * The URL is vetted with the same guard the outbound webhooks use, and every request the page then makes
 * (redirect hops, frames, scripts, XHR) is vetted too, so a public page that redirects or embeds
 * http://169.254.169.254/ or http://localhost/ is cut off. Verdicts are cached per host for the page.
 */
export async function gotoPublicUrl(page: InterceptablePage, url: string, options?: Record<string, unknown>) {
    await assertSafeWebhookUrl(url);

    const verdicts = new Map<string, Promise<boolean>>();
    const isAllowed = (requestUrl: string) => {
        let host: string;
        try {
            host = new URL(requestUrl).host;
        } catch {
            return Promise.resolve(false);
        }
        let verdict = verdicts.get(host);
        if (!verdict) {
            verdict = assertSafeWebhookUrl(requestUrl).then(
                () => true,
                () => false,
            );
            verdicts.set(host, verdict);
        }
        return verdict;
    };

    await page.setRequestInterception(true);
    page.on("request", (request) => {
        const requestUrl = request.url();
        if (INLINE_SCHEMES.test(requestUrl)) {
            void request.continue();
            return;
        }
        void isAllowed(requestUrl).then((allowed) => (allowed ? request.continue() : request.abort("blockedbyclient")));
    });

    return page.goto(url, options);
}
