import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphError, IG_GRAPH_BASE_URL, graphCall, graphPostJson } from "../metaGraph";

const respond = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("graphCall", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("sends POST parameters and the token in the body, never in the URL", async () => {
        const fetchMock = respond(200, { id: "1" });
        vi.stubGlobal("fetch", fetchMock);
        expect(await graphCall("POST", "page-1/feed", { message: "Hi" }, "secret")).toEqual({ id: "1" });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://graph.facebook.com/v26.0/page-1/feed");
        expect(String(init.body)).toBe("message=Hi&access_token=secret");
        expect(init.redirect).toBe("error");
    });

    it("uses the Instagram host with the token in an Authorization header, never in the URL or body", async () => {
        const fetchMock = respond(200, { id: "r-1" });
        vi.stubGlobal("fetch", fetchMock);
        await graphCall("POST", "c-1/replies", { message: "Hi" }, "secret", IG_GRAPH_BASE_URL);
        await graphCall("GET", "igsid-1", { fields: "name,username" }, "secret", IG_GRAPH_BASE_URL);

        const [postUrl, postInit] = fetchMock.mock.calls[0];
        expect(postUrl).toBe("https://graph.instagram.com/v26.0/c-1/replies");
        expect(String(postInit.body)).toBe("message=Hi");
        expect(postInit.headers).toMatchObject({ Authorization: "Bearer secret" });
        const [getUrl, getInit] = fetchMock.mock.calls[1];
        expect(getUrl).toBe("https://graph.instagram.com/v26.0/igsid-1?fields=name%2Cusername");
        expect(getInit.headers).toEqual({ Authorization: "Bearer secret" });
    });

    it("treats a refusal as certain and a 5xx or network failure as uncertain", async () => {
        vi.stubGlobal("fetch", respond(400, { error: { message: "(#100) Invalid parameter" } }));
        const refused = await graphCall("GET", "c-1", { fields: "status_code" }, "t").catch((e) => e);
        expect(refused).toBeInstanceOf(GraphError);
        expect(refused).toMatchObject({ message: "(#100) Invalid parameter", uncertain: false });

        vi.stubGlobal("fetch", respond(502, {}));
        expect(await graphCall("GET", "c-1", {}, "t").catch((e) => e)).toMatchObject({ uncertain: true });

        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket hang up")));
        expect(await graphCall("POST", "ig-1/media_publish", {}, "t").catch((e) => e)).toMatchObject({ uncertain: true, message: "Meta didn't answer in time." });
    });
});

describe("graphPostJson", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("sends a JSON body with the token in the Authorization header, never in the URL", async () => {
        const fetchMock = respond(200, { recipient_id: "p", message_id: "m" });
        vi.stubGlobal("fetch", fetchMock);
        expect(await graphPostJson("page-1/messages", { message: { text: "Hi" } }, "secret")).toEqual({ recipient_id: "p", message_id: "m" });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://graph.facebook.com/v26.0/page-1/messages");
        expect(JSON.parse(init.body)).toEqual({ message: { text: "Hi" } });
        expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer secret" });
        expect(init.redirect).toBe("error");
    });

    it("posts to the Instagram host when asked, still with a Bearer header", async () => {
        const fetchMock = respond(200, { recipient_id: "p", message_id: "m" });
        vi.stubGlobal("fetch", fetchMock);
        await graphPostJson("ig-1/messages", { recipient: { comment_id: "c" } }, "secret", IG_GRAPH_BASE_URL);
        expect(fetchMock.mock.calls[0][0]).toBe("https://graph.instagram.com/v26.0/ig-1/messages");
        expect(fetchMock.mock.calls[0][1].headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer secret" });
    });

    it("reports refusals as certain and network failures as uncertain", async () => {
        vi.stubGlobal("fetch", respond(400, { error: { message: "(#551) This person isn't available right now." } }));
        expect(await graphPostJson("p/messages", {}, "t").catch((e) => e)).toMatchObject({ uncertain: false, message: "(#551) This person isn't available right now." });

        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("reset")));
        expect(await graphPostJson("p/messages", {}, "t").catch((e) => e)).toMatchObject({ uncertain: true });
    });
});
