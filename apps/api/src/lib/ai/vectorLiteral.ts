// Must match the vector(1536) columns in prisma/schema.prisma.
export const EMBEDDING_DIM = 1536;

/** Bracketed literal pgvector's `::vector` cast accepts, e.g. "[0.1,0.2,0.3]". */
export function toVectorLiteral(embedding: number[]): string {
    if (embedding.length !== EMBEDDING_DIM) {
        throw new Error(`Invalid embedding: expected ${EMBEDDING_DIM} dimensions, got ${embedding.length}`);
    }
    for (const n of embedding) {
        if (typeof n !== "number" || !Number.isFinite(n)) {
            throw new Error(`Invalid embedding: non-finite value ${String(n)}`);
        }
    }
    return `[${embedding.join(",")}]`;
}
