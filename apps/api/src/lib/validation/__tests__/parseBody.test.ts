import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseBody } from "../parseBody";

const schema = z.object({ name: z.string().min(1), count: z.number().int().optional() });

function jsonRequest(body: string) {
    return new Request("http://localhost/x", { method: "POST", body });
}

describe("parseBody", () => {
    it("returns the parsed data for a valid body (unknown keys stripped)", async () => {
        const result = await parseBody(jsonRequest(JSON.stringify({ name: "a", count: 2, extra: true })), schema);

        expect(result).toEqual({ ok: true, data: { name: "a", count: 2 } });
    });

    it("returns a 400 with field errors in the routes' error shape", async () => {
        const result = await parseBody(jsonRequest(JSON.stringify({ name: "", count: "2" })), schema);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.response.status).toBe(400);
        const json = await result.response.json();
        expect(json.error).toBe("Invalid payload");
        expect(json.code).toBe("VALIDATION_ERROR");
        expect(Object.keys(json.details.fieldErrors).sort()).toEqual(["count", "name"]);
    });

    it("returns a 400 for malformed JSON", async () => {
        const result = await parseBody(jsonRequest("{nope"), schema);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.response.status).toBe(400);
        expect((await result.response.json()).code).toBe("VALIDATION_ERROR");
    });
});
