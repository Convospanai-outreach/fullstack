import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getToken } from "next-auth/jwt";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";

const INTERNAL_API_ORIGIN =
    process.env["API_INTERNAL_ORIGIN"] ||
    process.env["API_BASE_URL"] ||
    "http://localhost:3001";

function getTargetUrl(req: NextRequest, pathParts: string[] | undefined): URL {
    if (!pathParts || pathParts.length === 0) {
        throw new Error("Proxy path is required");
    }

    if (!/^https?:\/\//.test(INTERNAL_API_ORIGIN)) {
        throw new Error("API_INTERNAL_ORIGIN must be an absolute URL");
    }

    const normalizedPath = pathParts.join("/");
    const target = new URL(`/${normalizedPath}${req.nextUrl.search}`, INTERNAL_API_ORIGIN);

    // Guard against accidental recursive proxy loops.
    if (target.origin === req.nextUrl.origin && target.pathname.startsWith("/api/proxy")) {
        throw new Error("Invalid proxy target: recursive proxy detected");
    }

    return target;
}

function getWebAuthUrl(req: NextRequest, pathParts: string[]): URL | null {
    if (pathParts[0] !== "auth") return null;
    const authPath = pathParts.slice(1).join("/");
    return new URL(`/api/auth/${authPath}${req.nextUrl.search}`, req.nextUrl.origin);
}

async function addInternalAuthHeaders(req: NextRequest, headers: Headers) {
    const secret = process.env["NEXTAUTH_SECRET"];
    if (!secret) return;

    const clerkUser = await findOrCreateClerkAppUser();
    if (clerkUser?.id) {
        const timestamp = String(Date.now());
        const email = clerkUser.email || "";
        const role = typeof clerkUser.enterpriseRole === "string" ? clerkUser.enterpriseRole : "";
        const payload = `v1.${timestamp}.${clerkUser.id}.${email}.${role}`;
        const signature = createHmac("sha256", secret).update(payload).digest("hex");

        headers.set("x-craftmyfunnel-user-id", clerkUser.id);
        headers.set("x-craftmyfunnel-user-email", email);
        headers.set("x-craftmyfunnel-user-role", role);
        headers.set("x-craftmyfunnel-auth-ts", timestamp);
        headers.set("x-craftmyfunnel-auth-signature", signature);
        return;
    }

    const token = await getToken({ req, secret });
    const userId = typeof token?.sub === "string"
        ? token.sub
        : typeof token?.["id"] === "string"
            ? token["id"]
            : "";

    if (!userId) return;

    const email = typeof token?.email === "string" ? token.email : "";
    const role = typeof token?.["enterpriseRole"] === "string" ? token["enterpriseRole"] : "";
    const timestamp = String(Date.now());
    const payload = `v1.${timestamp}.${userId}.${email}.${role}`;
    const signature = createHmac("sha256", secret).update(payload).digest("hex");

    headers.set("x-craftmyfunnel-user-id", userId);
    headers.set("x-craftmyfunnel-user-email", email);
    headers.set("x-craftmyfunnel-user-role", role);
    headers.set("x-craftmyfunnel-auth-ts", timestamp);
    headers.set("x-craftmyfunnel-auth-signature", signature);
}

async function forwardRequest(req: NextRequest, pathParts: string[] | undefined) {
    try {
        if (!pathParts || pathParts.length === 0) {
            throw new Error("Proxy path is required");
        }

        const target = getWebAuthUrl(req, pathParts) ?? getTargetUrl(req, pathParts);
        const headers = new Headers(req.headers);

        headers.delete("host");
        headers.delete("connection");
        headers.delete("content-length");

        if (!getWebAuthUrl(req, pathParts)) {
            await addInternalAuthHeaders(req, headers);
        }

        const method = req.method.toUpperCase();
        const body =
            method === "GET" || method === "HEAD"
                ? null
                : await req.arrayBuffer();

        const requestInit: RequestInit = {
            method,
            headers,
            redirect: "manual",
        };

        if (body !== null) {
            requestInit.body = body;
        }

        const upstream = await fetch(target, requestInit);

        return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: upstream.headers,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Proxy failure";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardRequest(req, resolved.path);
}
