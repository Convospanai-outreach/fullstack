import crypto from "crypto";
import { prisma, type TransactionClient } from "@/lib/db";

export class BlindIndexService {
    private static getSecretKey(): string {
        return (
            process.env["BLIND_INDEX_KEY"] ||
            process.env["ENCRYPTION_KEY"] ||
            "cmf_default_blind_index_salt_secure"
        );
    }

    /**
     * Generates a tenant-scoped deterministic HMAC-SHA256 hash for blind indexing.
     * Hardened against rainbow tables and cross-tenant correlation attacks.
     */
    static computeHash(teamId: string, fieldName: string, plaintext: string): string {
        if (!teamId || !fieldName || plaintext === undefined || plaintext === null) {
            throw new Error("teamId, fieldName, and plaintext are required for blind indexing");
        }

        const normalized = String(plaintext).trim().toLowerCase();
        const secret = this.getSecretKey();
        const payload = `${teamId}:${fieldName}:${normalized}`;

        return crypto.createHmac("sha256", secret).update(payload).digest("hex");
    }

    /**
     * Upserts a blind index record for a specific entity field.
     */
    static async createBlindIndex(
        input: {
            teamId: string;
            entityType: string;
            entityId: string;
            fieldName: string;
            plaintext: string;
        },
        client: TransactionClient | typeof prisma = prisma
    ) {
        if (!input.plaintext) return null;

        const indexHash = this.computeHash(input.teamId, input.fieldName, input.plaintext);

        return await client.blindIndex.upsert({
            where: {
                teamId_entityType_entityId_fieldName: {
                    teamId: input.teamId,
                    entityType: input.entityType,
                    entityId: input.entityId,
                    fieldName: input.fieldName,
                },
            },
            update: {
                indexHash,
            },
            create: {
                teamId: input.teamId,
                entityType: input.entityType,
                entityId: input.entityId,
                fieldName: input.fieldName,
                indexHash,
            },
        });
    }

    /**
     * Searches for matching entity IDs by blind index hash without decrypting rows.
     */
    static async lookupByBlindIndex(
        teamId: string,
        entityType: string,
        fieldName: string,
        plaintext: string,
        client: TransactionClient | typeof prisma = prisma
    ): Promise<string[]> {
        if (!plaintext) return [];

        const indexHash = this.computeHash(teamId, fieldName, plaintext);

        const matches = await client.blindIndex.findMany({
            where: {
                teamId,
                entityType,
                fieldName,
                indexHash,
            },
            select: {
                entityId: true,
            },
        });

        return matches.map((m) => m.entityId);
    }
}
