import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.hoisted(() => vi.fn());
vi.mock("next-auth/jwt", () => ({ getToken }));

import { proxy } from "@/proxy";

const request = (url: string) => new NextRequest(url) as unknown as Parameters<typeof proxy>[0];

describe("the public careers pages and application form", () => {
    beforeEach(() => {
        vi.stubEnv("NODE_ENV", "production");
        getToken.mockResolvedValue(null);
    });
    afterEach(() => vi.unstubAllEnvs());

    it.each(["/careers", "/careers/sales-rep", "/api/careers/apply"])("lets a visitor with no session reach %s", async (path) => {
        const res = await proxy(request(`https://craftmyfunnel.live${path}`));

        expect(res.headers.get("location")).toBeNull();
        expect(res.status).toBe(200);
    });

    it("keeps the superadmin application endpoints behind the site's own checks", async () => {
        const res = await proxy(request("https://craftmyfunnel.live/careersx"));

        expect(res.headers.get("location") ?? "").toContain("/login");
    });
});
