import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphError, graphCall, graphPostJson } from "../metaGraph";

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

    it("reports refusals as certain and network failures as uncertain", async () => {
        vi.stubGlobal("fetch", respond(400, { error: { message: "(#551) This person isn't available right now." } }));
        expect(await graphPostJson("p/messages", {}, "t").catch((e) => e)).toMatchObject({ uncertain: false, message: "(#551) This person isn't available right now." });

        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("reset")));
        expect(await graphPostJson("p/messages", {}, "t").catch((e) => e)).toMatchObject({ uncertain: true });
    });
});
