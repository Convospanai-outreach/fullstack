import { NextRequest, NextResponse } from "next/server";

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

async function forwardRequest(req: NextRequest, pathParts: string[] | undefined) {
    try {
        const target = getTargetUrl(req, pathParts);
        const headers = new Headers(req.headers);

        headers.delete("host");
        headers.delete("connection");
        headers.delete("content-length");

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
