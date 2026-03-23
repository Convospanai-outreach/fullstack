import { NextResponse } from "next/server";

/**
 * Example Route Module compatible with Next.js signatures
 * Handled by the Fastify auto-loader
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "convospan-api"
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({
    message: "Data received",
    received: body
  }, { status: 201 });
}
