import { NextResponse } from "next/server";

function healthResponse() {
    const response = NextResponse.json({
        status: "UP",
        service: "convospan-web",
        timestamp: new Date().toISOString(),
    });
    response.headers.set("x-correlation-id", crypto.randomUUID());
    response.headers.set("Access-Control-Allow-Origin", "http://localhost:3000");
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-correlation-id");
    return response;
}

export async function GET() {
    return healthResponse();
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "http://localhost:3000",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, x-correlation-id",
        },
    });
}
