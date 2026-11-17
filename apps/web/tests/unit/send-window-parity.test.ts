import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as api from "../../../api/src/lib/sendWindow";
import * as web from "@/lib/sendWindow";

// apps/web/src/lib/sendWindow.ts mirrors apps/api/src/lib/sendWindow.ts (apps/web cannot import apps/api):
// both send paths must decide "send now or wait" the same way.
describe("send window parity", () => {
    it("the two files are identical", () => {
        const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8").replace(/\r\n/g, "\n");
        expect(read("../../src/lib/sendWindow.ts")).toBe(read("../../../api/src/lib/sendWindow.ts"));
    });

    it("both copies give the same answer", () => {
        const settings = { enabled: true, days: [1, 2, 3, 4, 5], startHour: 8, endHour: 18 };
        const lead = { location: "Pune, India" };
        for (const iso of ["2026-11-20T13:30:00Z", "2026-11-18T05:00:00Z", "2026-11-22T23:00:00Z"]) {
            const now = new Date(iso);
            const a = api.resolveRecipientTimeZone(lead, "UTC");
            const w = web.resolveRecipientTimeZone(lead, "UTC");
            expect(w).toEqual(a);
            expect(web.nextSendTime(now, w.timeZone, web.resolveSendWindow(settings), "job")).toEqual(
                api.nextSendTime(now, a.timeZone, api.resolveSendWindow(settings), "job"),
            );
        }
    });
});
