/** Bracketed literal pgvector's `::vector` cast accepts, e.g. "[0.1,0.2,0.3]". */
export function toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(",")}]`;
}
