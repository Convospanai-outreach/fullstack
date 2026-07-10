import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { audit } from "@/lib/governance/audit";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { applyRateLimit } from "@/lib/rateLimit";
import {
  API_KEY_MANAGEMENT_RATE_LIMIT,
  ApiKeyLimitError,
  ApiKeyValidationError,
  parseApiKeyCreationInput,
  parseApiKeyListPagination,
} from "@/lib/apiKeySecurity";
import {
  createTeamApiKey,
  listTeamApiKeys,
} from "@/lib/apiKeyService";

function invalidRequestResponse() {
  return NextResponse.json({ error: "Invalid API key request" }, { status: 400 });
}

async function requireAdminContext() {
  const context = await getCurrentContext();
  if (!context.userId || !context.teamId) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const permitted = await checkTeamPermission(
    context.userId,
    context.teamId,
    TeamRole.ADMIN
  );
  if (!permitted) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { context };
}

export async function GET(req: NextRequest) {
  try {
    const authorization = await requireAdminContext();
    if ("response" in authorization) return authorization.response;

    const rateLimited = await applyRateLimit(
      req,
      API_KEY_MANAGEMENT_RATE_LIMIT,
      "api-key-list",
      authorization.context.userId
    );
    if (rateLimited) return rateLimited;

    const { limit, offset } = parseApiKeyListPagination(new URL(req.url));
    const result = await listTeamApiKeys(
      authorization.context.teamId,
      limit,
      offset
    );

    return NextResponse.json({
      data: result.keys,
      meta: {
        limit,
        offset,
        total: result.total,
        hasMore: offset + result.keys.length < result.total,
      },
    });
  } catch (error) {
    if (error instanceof ApiKeyValidationError) return invalidRequestResponse();
    return NextResponse.json({ error: "Unable to list API keys" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await requireAdminContext();
    if ("response" in authorization) return authorization.response;

    const rateLimited = await applyRateLimit(
      req,
      API_KEY_MANAGEMENT_RATE_LIMIT,
      "api-key-create",
      authorization.context.userId
    );
    if (rateLimited) return rateLimited;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return invalidRequestResponse();
    }

    const input = parseApiKeyCreationInput(body);
    const result = await createTeamApiKey(
      authorization.context.teamId,
      input.name,
      input.scopes
    );

    await audit({
      actorId: authorization.context.userId,
      orgId: authorization.context.teamId,
      action: "API_KEY_CREATED",
      entity: "ApiKey",
      entityId: result.apiKey.id,
      metadata: {
        name: result.apiKey.name,
        scopes: result.apiKey.scopes,
        keyPrefix: result.apiKey.keyPrefix,
        keyLastFour: result.apiKey.keyLastFour,
      },
    });

    return NextResponse.json(
      { apiKey: result.apiKey, secret: result.secret },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ApiKeyValidationError) return invalidRequestResponse();
    if (error instanceof ApiKeyLimitError) {
      return NextResponse.json({ error: "Active API key limit reached" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to create API key" }, { status: 500 });
  }
}
