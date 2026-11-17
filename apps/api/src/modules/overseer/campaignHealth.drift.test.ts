import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { ICP_LIMITS, PACE_LIMITS } from "./campaignHealth";

// campaignHealth.ts repeats the web app's pace and ICP limits (the apps share no package). When the web
// sources are in the checkout, fail if the numbers differ. Skipped where the web app is not present.
const WEB = join(__dirname, "../../../../web/src/lib/campaigns");

function numbers(source: string, name: string): Record<string, number> {
    const block = new RegExp(`${name}\\s*=\\s*\\{([^}]*)\\}`).exec(source)?.[1] ?? "";
    return Object.fromEntries([...block.matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
}

describe("campaign health limits match the web app", () => {
    const paceFile = join(WEB, "paceRules.ts");
    const icpFile = join(WEB, "icpFit.ts");

    it.skipIf(!existsSync(paceFile))("pace limits", () => {
        expect(numbers(readFileSync(paceFile, "utf8"), "PACE_LIMITS")).toEqual(PACE_LIMITS);
    });

    it.skipIf(!existsSync(icpFile))("ICP limits", () => {
        expect(numbers(readFileSync(icpFile, "utf8"), "ICP_LIMITS")).toEqual(ICP_LIMITS);
    });
});
