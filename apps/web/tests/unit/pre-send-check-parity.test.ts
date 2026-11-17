import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as api from "../../../api/src/lib/preSendCheck";
import * as web from "@/lib/preSendCheck";

// apps/web/src/lib/preSendCheck.ts mirrors apps/api/src/lib/preSendCheck.ts (apps/web cannot import
// apps/api): both send paths must hold the same emails for the same reasons.
describe("pre-send check parity", () => {
    it("the two files are identical", () => {
        const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8").replace(/\r\n/g, "\n");
        expect(read("../../src/lib/preSendCheck.ts")).toBe(read("../../../api/src/lib/preSendCheck.ts"));
    });

    it("both copies give the same answer on sample emails", () => {
        const samples = [
            { to: "a@b.co", subject: "Hello", body: "<p>Hi there, quick note.</p>", kind: "sequence" as const, postalAddress: "1 Main St" },
            { to: "bad", subject: "", body: "Act now {{x}} https://a.example https://b.example", kind: "sequence" as const, postalAddress: "" },
            { to: "a@b.co", subject: "Re: hi", body: "<p>Thanks</p>", kind: "reply" as const, postalAddress: null },
        ];
        for (const s of samples) {
            expect(web.preSendCheck({ ...s, settings: web.resolveSendSafety({ allowedLinkHosts: ["x.example"] }) })).toEqual(
                api.preSendCheck({ ...s, settings: api.resolveSendSafety({ allowedLinkHosts: ["x.example"] }) }),
            );
        }
        expect(web.resolveSendSafety({ mode: "hold" })).toEqual(api.resolveSendSafety({ mode: "hold" }));
    });
});
