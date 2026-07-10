import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { audit } from "@/lib/governance/audit";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { applyRateLimit } from "@/lib/rateLimit";
import { API_KEY_MANAGEMENT_RATE_LIMIT } from "@/lib/apiKeySecurity";
import { revokeTeamApiKey } from "@/lib/apiKeyService";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getCurrentContext();
    if (!context.userId || !context.teamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const permitted = await checkTeamPermission(
      context.userId,
      context.teamId,
      TeamRole.ADMIN
    );
    if (!permitted) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rateLimited = await applyRateLimit(
      req,
      API_KEY_MANAGEMENT_RATE_LIMIT,
      "api-key-revoke",
      context.userId
    );
    if (rateLimited) return rateLimited;

    const result = await revokeTeamApiKey(context.teamId, id);
    if (!result.found) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (result.revoked) {
      await audit({
        actorId: context.userId,
        orgId: context.teamId,
        action: "API_KEY_REVOKED",
        entity: "ApiKey",
        entityId: id,
        metadata: {},
      });
    }

    return NextResponse.json({
      success: true,
      revoked: result.revoked,
      alreadyRevoked: result.alreadyRevoked,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to revoke API key" },
      { status: 500 }
    );
  }
}
