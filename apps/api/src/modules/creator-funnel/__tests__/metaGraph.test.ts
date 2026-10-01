import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphError, graphCall } from "../metaGraph";

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
