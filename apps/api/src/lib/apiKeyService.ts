import { prisma } from "@/lib/db";
import {
  API_KEY_MAX_ACTIVE_PER_TEAM,
  ApiKeyLimitError,
  ApiKeyScope,
  createApiKeySecret,
  getApiKeyDisplayMetadata,
} from "@/lib/apiKeySecurity";

type StoredApiKey = {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  lastUsedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
};

export type ApiKeyMetadata = Omit<StoredApiKey, "key"> & {
  keyPrefix: string;
  keyLastFour: string | null;
  legacy: boolean;
};

function toApiKeyMetadata(key: StoredApiKey): ApiKeyMetadata {
  const display = getApiKeyDisplayMetadata(key.key);
  return {
    id: key.id,
    name: key.name,
    scopes: key.scopes,
    lastUsedAt: key.lastUsedAt,
    isActive: key.isActive,
    createdAt: key.createdAt,
    ...display,
  };
}

const apiKeySelect = {
  id: true,
  name: true,
  key: true,
  scopes: true,
  lastUsedAt: true,
  isActive: true,
  createdAt: true,
} as const;

export async function listTeamApiKeys(teamId: string, limit: number, offset: number) {
  const [records, total] = await Promise.all([
    prisma.apiKey.findMany({
      where: { teamId },
      select: apiKeySelect,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.apiKey.count({ where: { teamId } }),
  ]);

  return {
    keys: records.map(toApiKeyMetadata),
    total,
  };
}

export async function createTeamApiKey(
  teamId: string,
  name: string,
  scopes: ApiKeyScope[]
) {
  const activeKeyCount = await prisma.apiKey.count({
    where: { teamId, isActive: true },
  });
  if (activeKeyCount >= API_KEY_MAX_ACTIVE_PER_TEAM) {
    throw new ApiKeyLimitError();
  }

  const generated = createApiKeySecret();
  const record = await prisma.apiKey.create({
    data: {
      teamId,
      name,
      scopes,
      key: generated.lookup,
    },
    select: apiKeySelect,
  });

  return {
    secret: generated.secret,
    apiKey: toApiKeyMetadata(record),
  };
}

export async function revokeTeamApiKey(teamId: string, id: string) {
  const update = await prisma.apiKey.updateMany({
    where: {
      id,
      teamId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  if (update.count === 1) {
    return { found: true, revoked: true, alreadyRevoked: false };
  }

  const existing = await prisma.apiKey.findFirst({
    where: { id, teamId },
    select: { id: true, isActive: true },
  });

  if (!existing) {
    return { found: false, revoked: false, alreadyRevoked: false };
  }

  return { found: true, revoked: false, alreadyRevoked: true };
}
