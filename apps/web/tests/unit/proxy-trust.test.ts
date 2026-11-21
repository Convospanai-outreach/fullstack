import { NextRequest } from "next/dist/server/web/spec-extension/request";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.hoisted(() => vi.fn());
vi.mock("next-auth/jwt", () => ({ getToken }));

import { proxy } from "@/proxy";

describe("the public trust pages", () => {
    beforeEach(() => {
        vi.stubEnv("NODE_ENV", "production");
        getToken.mockResolvedValue(null);
    });
    afterEach(() => vi.unstubAllEnvs());

    it.each(["/trust/dpa", "/trust/subprocessors"])("lets a visitor with no session reach %s", async (path) => {
        const res = await proxy(new NextRequest(`https://craftmyfunnel.live${path}`) as unknown as Parameters<typeof proxy>[0]);

        expect(res.headers.get("location")).toBeNull();
        expect(res.status).toBe(200);
    });
});
