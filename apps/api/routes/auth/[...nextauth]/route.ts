import { NextRequest, NextResponse } from "next/server";

const WEB_AUTH_ORIGIN = process.env["NEXTAUTH_URL"] || "http://localhost:3000";

function getWebAuthUrl(req: NextRequest) {
    const source = new URL(req.url);
    const targetPath = source.pathname.replace(/^\/auth\/?/, "/api/auth/");
    return new URL(`${targetPath}${source.search}`, WEB_AUTH_ORIGIN);
}

async function forwardToWebAuth(req: NextRequest) {
    const target = getWebAuthUrl(req);
    const headers = new Headers(req.headers);
    headers.delete("host");
    headers.delete("connection");
    headers.delete("content-length");

    const method = req.method.toUpperCase();
    const init: RequestInit = {
        method,
        headers,
        redirect: "manual",
    };

    if (method !== "GET" && method !== "HEAD") {
        init.body = await req.arrayBuffer();
    }

    const upstream = await fetch(target, init);
    return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: upstream.headers,
    });
}

export async function GET(req: NextRequest) {
    return forwardToWebAuth(req);
}

export async function POST(req: NextRequest) {
    return forwardToWebAuth(req);
}
