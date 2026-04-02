import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Example Route Module compatible with Next.js signatures
 * Handled by the Fastify auto-loader
 */
export async function GET() {
  const startedAt = Date.now();
  const runtimeMode = process.env["CONVOSPAN_RUNTIME_MODE"] || "";
  const skipHardwareVerification = process.env["BETA_SKIP_HARDWARE_VERIFY"] === "true" || runtimeMode === "email_first_beta";
  const lenientHealthMode = skipHardwareVerification || process.env["NODE_ENV"] !== "production";
  const edgeNodeUri = skipHardwareVerification ? "" : (process.env["EDGE_NODE_URI"] || process.env["EDGE_NODE_URL"] || "");
  let database = "down";
  let edge = edgeNodeUri ? "down" : "not_configured";
  let edgeError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch (error) {
    return NextResponse.json({
      status: lenientHealthMode ? "degraded" : "unhealthy",
      timestamp: new Date().toISOString(),
      service: "convospan-api",
      checks: {
        database,
        edge
      },
      durationMs: Date.now() - startedAt
    }, { status: lenientHealthMode ? 200 : 503 });
  }

  if (edgeNodeUri) {
    try {
      const response = await fetch(`${edgeNodeUri}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(2500),
      });
      edge = response.ok ? "up" : "degraded";
    } catch (error: any) {
      edge = "degraded";
      edgeError = error?.message || "edge check failed";
    }
  }

  const status = edge === "degraded" ? "degraded" : "healthy";
  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    service: "convospan-api",
    checks: {
      database,
      edge,
      edgeError
    },
    durationMs: Date.now() - startedAt
  }, { status: 200 });
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({
    message: "Data received",
    received: body
  }, { status: 201 });
}
