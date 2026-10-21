import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockDomainSearch, mockFindAndStore, mockVerify } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockDomainSearch: vi.fn(),
    mockFindAndStore: vi.fn(),
    mockVerify: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("../../service/hunterClient", () => ({ hunterClient: { domainSearch: mockDomainSearch } }));
vi.mock("../../service/hunterService", () => ({
    hunterService: { findAndStoreEmail: mockFindAndStore, verifyAndUpdateEmail: mockVerify },
}));

import { GET as domainSearch } from "../domain-search";
import { POST as findEmail } from "../find-email";
import { POST as verifyEmail } from "../verify-email";

const post = (body: unknown) => new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body) });

describe("Hunter endpoints", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockDomainSearch.mockResolvedValue({});
    });

    describe("without a session", () => {
        beforeEach(() => mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null }));

        it("domain-search does not call Hunter", async () => {
            const res = await domainSearch(new Request("http://localhost/x?domain=example.com"));
            expect(res.status).toBe(401);
            expect(mockDomainSearch).not.toHaveBeenCalled();
        });

        it("find-email does not call Hunter", async () => {
            const res = await findEmail(post({ firstName: "A", lastName: "B", domain: "example.com" }));
            expect(res.status).toBe(401);
            expect(mockFindAndStore).not.toHaveBeenCalled();
        });

        it("verify-email does not call Hunter", async () => {
            const res = await verifyEmail(post({ email: "a@example.com" }));
            expect(res.status).toBe(401);
            expect(mockVerify).not.toHaveBeenCalled();
        });
    });

    it.each([
        ["1000000", 25],
        ["-5", 1],
        ["abc", 10],
        ["12", 12],
    ])("domain-search with limit=%s asks Hunter for %i results", async (limit, expected) => {
        await domainSearch(new Request(`http://localhost/x?domain=example.com&limit=${limit}`));

        expect(mockDomainSearch).toHaveBeenCalledWith("example.com", expected);
    });
});
