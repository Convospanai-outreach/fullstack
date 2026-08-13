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

function corsHeaders(req: NextRequest): HeadersInit {
    const origin = req.headers.get("origin") || "";
    if (!origin.startsWith("chrome-extension://")) return {};
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, x-extension-key",
        "Access-Control-Max-Age": "600"
    };
}

async function forwardExtensionRequest(req: NextRequest, pathParts: string[]) {
    const cors = corsHeaders(req);
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

        const responseHeaders = new Headers(upstream.headers);
        for (const [key, value] of Object.entries(cors)) responseHeaders.set(key, value);

        return new NextResponse(upstream.body, {
            status: upstream.status,
            headers: responseHeaders
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Extension proxy failure";
        return NextResponse.json({ ok: false, error: message }, { status: 502, headers: cors });
    }
}

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardExtensionRequest(req, resolved.path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    const resolved = await params;
    return forwardExtensionRequest(req, resolved.path);
}
