import { GraphError } from "./metaGraph";

// Minimal LinkedIn client for the creator funnel publisher (phase 7). Loaded lazily by the
// publisher and the token check, so it costs nothing at boot. Tokens go in the Authorization
// header only and are never logged. Like metaGraph.ts, a timeout, network failure or 5xx is
// "uncertain" (LinkedIn may have done it), so a post call that ended that way is never repeated.
//
// Checked 2026-10-04:
// - Posts API: POST /rest/posts, headers LinkedIn-Version: YYYYMM + X-Restli-Protocol-Version: 2.0.0,
//   201 with the post id in x-restli-id; w_member_social (profile) / w_organization_social (page).
//   https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
// - commentary is "little" text: | { } @ [ ] ( ) < > # \ * _ ~ must be backslash-escaped to stay
//   plain text; "#word" is a hashtag. https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/little-text-format
// - Images API: POST /rest/images?action=initializeUpload {initializeUploadRequest:{owner}} ->
//   uploadUrl + urn:li:image:...; upload is a PUT with the OAuth token; no synchronous upload, so
//   an image is PROCESSING for a while; w_member_social tokens can't GET /rest/images (write-only).
//   https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api
//   https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/vector-asset-api (upload: PUT + token)
// - MultiImage: 2 to 20 images in content.multiImage.images.
//   https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/multiimage-post-api
// - Limits: Share on LinkedIn allows 150 requests per member per day; the Community Management
//   Development tier 100 per member and 500 per app per day. LinkedIn enforces them (429).

const API_BASE = "https://api.linkedin.com";
// Each version is retired about a year after release (202510 sunsets 2026-10-15); bump this and
// the copy in apps/web linkedinConnect.ts yearly.
export const LINKEDIN_VERSION = "202609";
const TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 30_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // the content-media bucket's own limit

export class LinkedInError extends GraphError {}

function errorFor(status: number, json: any): LinkedInError {
    if (status === 401) return new LinkedInError("LinkedIn signed this account out. Reconnect it in Settings > Social accounts.", false);
    if (status === 403) return new LinkedInError("LinkedIn says this account isn't allowed to post here. Reconnect it in Settings > Social accounts.", false);
    if (status === 429) return new LinkedInError("LinkedIn's daily limit for this account is used up. Send it again tomorrow.", false);
    const detail = typeof json?.message === "string" ? json.message : `LinkedIn returned HTTP ${status}.`;
    return new LinkedInError(detail.slice(0, 300), status >= 500);
}

async function request(method: "GET" | "POST", path: string, token: string, body?: unknown) {
    let res: Response;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                "LinkedIn-Version": LINKEDIN_VERSION,
                "X-Restli-Protocol-Version": "2.0.0",
                ...(body === undefined ? {} : { "Content-Type": "application/json" }),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            redirect: "error",
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        throw new LinkedInError("LinkedIn didn't answer in time.", true);
    }
    const json: any = await res.json().catch(() => null);
    if (!res.ok) throw errorFor(res.status, json);
    return { res, json };
}

const RESERVED = new Set(["|", "{", "}", "@", "[", "]", "(", ")", "<", ">", "*", "_", "~"]);
const WORD_CHAR = /[\p{L}\p{N}_]/u;

/** Plain text as LinkedIn "little" text: reserved characters escaped, "#word" kept as a hashtag. */
export function escapeLittleText(text: string): string {
    let out = "";
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]!;
        if (ch === "\\") out += "\\\\";
        else if (RESERVED.has(ch)) out += `\\${ch}`;
        else if (ch === "#") {
            // A hashtag only where a person would write one, so "site.com/#pricing" stays a link.
            const startsWord = i === 0 || /\s/.test(text[i - 1]!);
            const next = text[i + 1];
            out += startsWord && next !== undefined && WORD_CHAR.test(next) ? "#" : "\\#";
        } else out += ch;
    }
    return out;
}

function linkedInUploadUrl(value: unknown): URL {
    let url: URL;
    try {
        url = new URL(String(value));
    } catch {
        throw new LinkedInError("LinkedIn didn't return an upload address.", false);
    }
    // The upload carries the account's token, so it only ever goes to LinkedIn.
    const host = url.hostname;
    if (url.protocol !== "https:" || !(host === "linkedin.com" || host.endsWith(".linkedin.com"))) {
        throw new LinkedInError("LinkedIn returned an unexpected upload address.", false);
    }
    return url;
}

async function readImage(mediaUrl: string): Promise<ArrayBuffer> {
    let res: Response;
    try {
        res = await fetch(mediaUrl, { redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
        throw new LinkedInError("Couldn't read one of the post's images. Send it again.", false);
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (!res.ok || declared > MAX_IMAGE_BYTES) throw new LinkedInError("Couldn't read one of the post's images. Send it again.", false);
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) throw new LinkedInError("One of the post's images is too large for LinkedIn.", false);
    return bytes;
}

/** Uploads one image owned by the post's author (person or organization URN). Nothing is public yet. */
export async function uploadImage(ownerUrn: string, mediaUrl: string, token: string): Promise<string> {
    const { json } = await request("POST", "/rest/images?action=initializeUpload", token, { initializeUploadRequest: { owner: ownerUrn } });
    const image = json?.value?.image;
    if (typeof image !== "string" || !image.startsWith("urn:li:image:")) throw new LinkedInError("LinkedIn didn't return an image id.", false);
    const uploadUrl = linkedInUploadUrl(json?.value?.uploadUrl);
    const bytes = await readImage(mediaUrl);
    let res: Response;
    try {
        res = await fetch(uploadUrl, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
            body: bytes,
            redirect: "error",
            signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
        });
    } catch {
        throw new LinkedInError("LinkedIn didn't take the image in time. Send it again.", false);
    }
    if (!res.ok) throw new LinkedInError(`LinkedIn didn't take the image (HTTP ${res.status}).`, false);
    return image;
}

export type ImageState = "AVAILABLE" | "PROCESSING" | "FAILED" | "UNKNOWN";

/** An uploaded image's processing state. Profile tokens can't read images, which is UNKNOWN. */
export async function imageState(imageUrn: string, token: string): Promise<ImageState> {
    try {
        const { json } = await request("GET", `/rest/images/${encodeURIComponent(imageUrn)}`, token);
        if (json?.status === "AVAILABLE") return "AVAILABLE";
        if (json?.status === "PROCESSING_FAILED") return "FAILED";
        if (json?.status === "PROCESSING" || json?.status === "WAITING_UPLOAD") return "PROCESSING";
        return "UNKNOWN";
    } catch {
        return "UNKNOWN";
    }
}

export function postBody(authorUrn: string, commentary: string, imageUrns: string[]) {
    const content =
        imageUrns.length === 1
            ? { content: { media: { id: imageUrns[0] } } }
            : imageUrns.length > 1
              ? { content: { multiImage: { images: imageUrns.map((id) => ({ id })) } } }
              : {};
    return {
        author: authorUrn,
        commentary,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
        ...content,
    };
}

/** Creates the post (the call that makes it public). Returns its URN, or null when LinkedIn sent 201 without one. */
export async function createPost(token: string, body: ReturnType<typeof postBody>): Promise<string | null> {
    const { res } = await request("POST", "/rest/posts", token, body);
    const id = res.headers.get("x-restli-id");
    return id && id.startsWith("urn:li:") ? id : null;
}

/** Whether the saved token still works: /v2/userinfo for a profile, the page-role finder for a page. */
export async function tokenStillValid(platform: string, token: string): Promise<boolean | null> {
    const path = platform === "LINKEDIN_ORG" ? "/rest/organizationAcls?q=roleAssignee&count=1" : "/v2/userinfo";
    let res: Response;
    try {
        res = await fetch(`${API_BASE}${path}`, {
            headers: { Authorization: `Bearer ${token}`, "LinkedIn-Version": LINKEDIN_VERSION, "X-Restli-Protocol-Version": "2.0.0" },
            redirect: "error",
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch {
        return null; // couldn't ask; try again tomorrow
    }
    if (res.status === 401) return false;
    return res.ok ? true : null;
}
