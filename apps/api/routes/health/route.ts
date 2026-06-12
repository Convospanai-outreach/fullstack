import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getConfiguredEdgeRuntimeEndpoint,
  getEdgeRuntimeAvailability,
  isEdgeRuntimeRequired,
} from "@/lib/edgeRuntime";

/**
 * Example Route Module compatible with Next.js signatures
 * Handled by the Fastify auto-loader
 */
type HealthProbeMode = "liveness" | "readiness";

function resolveProbeMode(req: Request): HealthProbeMode {
  const probe = new URL(req.url).searchParams.get("probe")?.toLowerCase();
  if (probe === "live" || probe === "liveness") {
    return "liveness";
  }
  if (probe === "ready" || probe === "readiness") {
    return "readiness";
  }
  return process.env["NODE_ENV"] === "production" ? "readiness" : "liveness";
}

export async function GET(req: Request) {
  const startedAt = Date.now();
  const probe = resolveProbeMode(req);
  if (probe === "liveness") {
    return NextResponse.json({
      status: "alive",
      probe,
      timestamp: new Date().toISOString(),
      service: "craftmyfunnel-api",
      durationMs: Date.now() - startedAt
    }, { status: 200 });
  }

  const runtimeMode = process.env["CRAFTMYFUNNEL_RUNTIME_MODE"] || "";
  const skipHardwareVerification = process.env["BETA_SKIP_HARDWARE_VERIFY"] === "true" || runtimeMode === "email_first_beta";
  const edgeRequired = !skipHardwareVerification && isEdgeRuntimeRequired();
  const strictReadiness = process.env["NODE_ENV"] === "production" && edgeRequired;
  const edgeNodeUri = skipHardwareVerification ? undefined : getConfiguredEdgeRuntimeEndpoint();
  let database = "down";
  let edge = edgeNodeUri ? "down" : "not_configured";
  let edgeError: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "up";
  } catch (error) {
    return NextResponse.json({
      status: "unhealthy",
      probe,
      timestamp: new Date().toISOString(),
      service: "craftmyfunnel-api",
      checks: {
        database,
        edge
      },
      durationMs: Date.now() - startedAt
    }, { status: 503 });
  }

  if (!skipHardwareVerification) {
    const edgeAvailability = await getEdgeRuntimeAvailability();
    edge =
      edgeAvailability.status === "UP"
        ? "up"
        : edgeAvailability.status === "NOT_CONFIGURED"
          ? "not_configured"
          : "degraded";
    edgeError = edgeAvailability.available ? null : edgeAvailability.message;

    if (!edgeAvailability.configured && edgeRequired) {
      edge = "missing";
    }
  }

  const edgeIsFailure = edge === "degraded" || edge === "down" || edge === "missing";
  const status = edgeIsFailure ? (strictReadiness ? "unhealthy" : "degraded") : "healthy";
  return NextResponse.json({
    status,
    probe,
    timestamp: new Date().toISOString(),
    service: "craftmyfunnel-api",
    checks: {
      database,
      edge,
      edgeError,
      edgeRequired
    },
    durationMs: Date.now() - startedAt
  }, { status: strictReadiness && edgeIsFailure ? 503 : 200 });
}

export async function POST(req: Request) {
  const body = await req.json();
  return NextResponse.json({
    message: "Data received",
    received: body
  }, { status: 201 });
}
