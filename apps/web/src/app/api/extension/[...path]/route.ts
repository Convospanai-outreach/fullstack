import { NextRequest, NextResponse } from "next/server";

const INTERNAL_API_ORIGIN =
    process.env["API_INTERNAL_ORIGIN"] ||
    process.env["API_BASE_URL"] ||
    "http://localhost:3001";

function targetUrl(req: NextRequest, pathParts: string[]): URL {
    if (!/^https?:\/\//.test(INTERNAL_API_ORIGIN)) {
        throw new Error("API_INTERNAL_ORIGIN must be an absolute URL");
    }
    return new URL(`/extension/${pathParts.join("/")}${req.nextUrl.search}`, INTERNAL_API_ORIGIN);
}

async function forwardExtensionRequest(req: NextRequest, pathParts: string[]) {
    try {
        const headers = new Headers(req.headers);
        headers.delete("host");
        headers.delete("connection");
        headers.delete("content-length");

        const method = req.method.toUpperCase();
        const body = method === "GET" || method === "HEAD"
            ? null
            : await req.arrayBuffer();

        const upstream = await fetch(targetUrl(req, pathParts), {
            method,
            headers,
            body,
            redirect: "manual"
        });

        return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: upstream.headers
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Extension proxy failure";
        return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardExtensionRequest(req, resolved.path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardExtensionRequest(req, resolved.path);
}
