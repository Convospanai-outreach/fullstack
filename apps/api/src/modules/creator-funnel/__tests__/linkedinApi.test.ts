import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPost, escapeLittleText, imageState, LinkedInError, postBody, tokenStillValid, uploadImage } from "../linkedinApi";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(body === null ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

describe("linkedinApi", () => {
    const fetchMock = vi.fn();
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
    });
    afterEach(() => vi.unstubAllGlobals());

    describe("escapeLittleText", () => {
        it("escapes every reserved character, keeps hashtags, and leaves URL fragments as text", () => {
            const input = "Launch (beta) | {v2} @team [now] <soon> *bold* _x_ ~y~ back\\slash #launch see https://site.com/a_b/#pricing and C# or #1";
            expect(escapeLittleText(input)).toBe(
                "Launch \\(beta\\) \\| \\{v2\\} \\@team \\[now\\] \\<soon\\> \\*bold\\* \\_x\\_ \\~y\\~ back\\\\slash #launch see https://site.com/a\\_b/\\#pricing and C\\# or #1"
            );
        });

        it("treats a hashtag at the start or after a newline as a hashtag, and a lone # as text", () => {
            expect(escapeLittleText("#hello\n#world #")).toBe("#hello\n#world \\#");
        });
    });

    it("builds text, single-image and multi-image post bodies", () => {
        expect(postBody("urn:li:person:p1", "hi", [])).not.toHaveProperty("content");
        expect(postBody("urn:li:person:p1", "hi", ["urn:li:image:a"]).content).toEqual({ media: { id: "urn:li:image:a" } });
        expect(postBody("urn:li:organization:1", "hi", ["urn:li:image:a", "urn:li:image:b"]).content).toEqual({
            multiImage: { images: [{ id: "urn:li:image:a" }, { id: "urn:li:image:b" }] },
        });
        expect(postBody("urn:li:person:p1", "hi", [])).toMatchObject({ author: "urn:li:person:p1", visibility: "PUBLIC", lifecycleState: "PUBLISHED" });
    });

    describe("createPost", () => {
        it("sends the versioned headers and returns the id from x-restli-id", async () => {
            fetchMock.mockResolvedValue(json(null, 201, { "x-restli-id": "urn:li:share:123" }));
            expect(await createPost("tok", postBody("urn:li:person:p1", "hi", []))).toBe("urn:li:share:123");
            const [url, init] = fetchMock.mock.calls[0]!;
            expect(url).toBe("https://api.linkedin.com/rest/posts");
            expect(init.headers).toMatchObject({ Authorization: "Bearer tok", "X-Restli-Protocol-Version": "2.0.0" });
            expect(init.headers["LinkedIn-Version"]).toMatch(/^\d{6}$/);
        });

        it("returns null for a 201 without an id, so the post still counts as published", async () => {
            fetchMock.mockResolvedValue(json(null, 201));
            expect(await createPost("tok", postBody("urn:li:person:p1", "hi", []))).toBeNull();
        });

        it("marks 4xx as certain and 5xx or a timeout as uncertain", async () => {
            fetchMock.mockResolvedValueOnce(json({ message: "nope" }, 429));
            await expect(createPost("tok", postBody("a", "b", []))).rejects.toMatchObject({ uncertain: false, message: expect.stringMatching(/daily limit/) });
            fetchMock.mockResolvedValueOnce(json({ message: "conflict" }, 409));
            await expect(createPost("tok", postBody("a", "b", []))).rejects.toMatchObject({ uncertain: false });
            fetchMock.mockResolvedValueOnce(json({ message: "oops" }, 503));
            await expect(createPost("tok", postBody("a", "b", []))).rejects.toMatchObject({ uncertain: true });
            fetchMock.mockRejectedValueOnce(new Error("aborted"));
            await expect(createPost("tok", postBody("a", "b", []))).rejects.toBeInstanceOf(LinkedInError);
        });
    });

    describe("uploadImage", () => {
        const init = (uploadUrl: string) => json({ value: { image: "urn:li:image:img1", uploadUrl } });

        it("registers the image for the author, fetches it and PUTs it to LinkedIn with the token", async () => {
            fetchMock
                .mockResolvedValueOnce(init("https://www.linkedin.com/dms-uploads/abc/0?x=1"))
                .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
                .mockResolvedValueOnce(new Response(null, { status: 201 }));

            expect(await uploadImage("urn:li:person:p1", "https://media.test/a.jpg", "tok")).toBe("urn:li:image:img1");
            expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ initializeUploadRequest: { owner: "urn:li:person:p1" } });
            expect(fetchMock.mock.calls[1]![1].redirect).toBe("error");
            const put = fetchMock.mock.calls[2]!;
            expect(String(put[0])).toBe("https://www.linkedin.com/dms-uploads/abc/0?x=1");
            expect(put[1]).toMatchObject({ method: "PUT", headers: { Authorization: "Bearer tok" } });
        });

        it("never sends the token to an upload address outside linkedin.com", async () => {
            fetchMock.mockResolvedValueOnce(init("https://evil.example/upload"));
            await expect(uploadImage("urn:li:person:p1", "https://media.test/a.jpg", "tok")).rejects.toThrow("unexpected upload address");
            fetchMock.mockResolvedValueOnce(init("https://linkedin.com.evil.example/upload"));
            await expect(uploadImage("urn:li:person:p1", "https://media.test/a.jpg", "tok")).rejects.toThrow("unexpected upload address");
            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it("refuses an image larger than 8 MB", async () => {
            fetchMock
                .mockResolvedValueOnce(init("https://www.linkedin.com/dms-uploads/abc/0"))
                .mockResolvedValueOnce(new Response("x", { status: 200, headers: { "content-length": String(9 * 1024 * 1024) } }));
            await expect(uploadImage("urn:li:person:p1", "https://media.test/a.jpg", "tok")).rejects.toThrow(/read one of the post's images/);
        });
    });

    it("reads image state, and reports UNKNOWN when a profile token can't read images", async () => {
        fetchMock.mockResolvedValueOnce(json({ status: "AVAILABLE" }));
        expect(await imageState("urn:li:image:a", "tok")).toBe("AVAILABLE");
        fetchMock.mockResolvedValueOnce(json({ status: "PROCESSING" }));
        expect(await imageState("urn:li:image:a", "tok")).toBe("PROCESSING");
        fetchMock.mockResolvedValueOnce(json({ status: "PROCESSING_FAILED" }));
        expect(await imageState("urn:li:image:a", "tok")).toBe("FAILED");
        fetchMock.mockResolvedValueOnce(json({ message: "forbidden" }, 403));
        expect(await imageState("urn:li:image:a", "tok")).toBe("UNKNOWN");
        expect(fetchMock.mock.calls[0]![0]).toBe("https://api.linkedin.com/rest/images/urn%3Ali%3Aimage%3Aa");
    });

    it("says whether a token still works: 401 no, 2xx yes, anything else unknown", async () => {
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
        expect(await tokenStillValid("LINKEDIN_MEMBER", "tok")).toBe(false);
        fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
        expect(await tokenStillValid("LINKEDIN_ORG", "tok")).toBe(true);
        fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
        expect(await tokenStillValid("LINKEDIN_MEMBER", "tok")).toBeNull();
    });
});
