import { describe, expect, it, vi } from "vitest";
import { sendMetaLeadEvents } from "./metaCapiSender";
import type { MetaLeadEventPayload } from "./metaCapi";

const TOKEN = "EAAB-secret-token-value";
const payload: MetaLeadEventPayload = {
    data: [
        {
            event_name: "Lead",
            event_time: 1_800_000_000,
            event_id: "11111111-2222-4333-8444-555555555555",
            event_source_url: "https://go.brand.test/spring",
            action_source: "website",
            user_data: { em: ["62a14e44f765419d10fea99367361a727c12365e2520f32218d505ed9aa0f62f"] },
        },
    ],
};

function fetchReturning(response: Response | Error) {
    return vi.fn(async () => {
        if (response instanceof Error) throw response;
        return response;
    }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("sendMetaLeadEvents", () => {
    it("posts to the pixel's events edge with the token in the Authorization header, not the URL or body", async () => {
        const fetchMock = fetchReturning(new Response(JSON.stringify({ events_received: 1 }), { status: 200 }));
        const result = await sendMetaLeadEvents({ pixelId: "123456789012345", accessToken: TOKEN, payload, fetchImpl: fetchMock });

        expect(result).toEqual({ ok: true });
        const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
        expect(url).toBe("https://graph.facebook.com/v26.0/123456789012345/events");
        expect(url).not.toContain(TOKEN);
        expect((init.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${TOKEN}`);
        expect(String(init.body)).not.toContain(TOKEN);
        expect(JSON.parse(String(init.body))).toEqual(payload);
    });

    it("has a timeout on the request", async () => {
        const fetchMock = fetchReturning(new Response("{}", { status: 200 }));
        await sendMetaLeadEvents({ pixelId: "123456789012345", accessToken: TOKEN, payload, fetchImpl: fetchMock });
        const init = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit;
        expect(init.signal).toBeDefined();
    });

    it.each([429, 500, 503])("treats HTTP %s as retryable", async (status) => {
        const result = await sendMetaLeadEvents({
            pixelId: "123456789012345",
            accessToken: TOKEN,
            payload,
            fetchImpl: fetchReturning(new Response("{}", { status })),
        });
        expect(result).toMatchObject({ ok: false, retryable: true, status });
    });

    it("treats other 4xx (bad token, bad pixel) as not retryable", async () => {
        const result = await sendMetaLeadEvents({
            pixelId: "123456789012345",
            accessToken: TOKEN,
            payload,
            fetchImpl: fetchReturning(new Response(JSON.stringify({ error: { code: 190, message: "Invalid OAuth access token." } }), { status: 400 })),
        });
        expect(result).toMatchObject({ ok: false, retryable: false, status: 400 });
    });

    it("treats network errors and timeouts as retryable", async () => {
        const network = await sendMetaLeadEvents({ pixelId: "123456789012345", accessToken: TOKEN, payload, fetchImpl: fetchReturning(new TypeError("fetch failed")) });
        expect(network).toMatchObject({ ok: false, retryable: true });
        const abort = new Error("aborted");
        abort.name = "AbortError";
        const timeout = await sendMetaLeadEvents({ pixelId: "123456789012345", accessToken: TOKEN, payload, fetchImpl: fetchReturning(abort) });
        expect(timeout).toMatchObject({ ok: false, retryable: true });
    });

    it("never puts the token in a failure result", async () => {
        const result = await sendMetaLeadEvents({
            pixelId: "123456789012345",
            accessToken: TOKEN,
            payload,
            fetchImpl: fetchReturning(new TypeError(`fetch failed for ${TOKEN}`)),
        });
        expect(JSON.stringify(result)).not.toContain(TOKEN);
    });
});
