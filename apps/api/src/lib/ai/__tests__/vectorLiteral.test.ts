import { describe, expect, it } from "vitest";
import { EMBEDDING_DIM, toVectorLiteral } from "../vectorLiteral";

describe("toVectorLiteral", () => {
    it("builds the bracketed literal for a full-size embedding", () => {
        const embedding = Array(EMBEDDING_DIM).fill(0.5);
        expect(toVectorLiteral(embedding)).toBe(`[${embedding.join(",")}]`);
    });

    it("throws on NaN or Infinity", () => {
        expect(() => toVectorLiteral([NaN, ...Array(EMBEDDING_DIM - 1).fill(0)])).toThrow(/non-finite/);
        expect(() => toVectorLiteral([Infinity, ...Array(EMBEDDING_DIM - 1).fill(0)])).toThrow(/non-finite/);
    });

    it("throws on a string smuggled into the array", () => {
        const embedding: unknown[] = [...Array(EMBEDDING_DIM - 1).fill(0), "1]'; DROP TABLE x;--"];
        expect(() => toVectorLiteral(embedding as number[])).toThrow(/non-finite/);
    });

    it("throws on the wrong dimension", () => {
        expect(() => toVectorLiteral([0.1, 0.2])).toThrow(/dimensions/);
    });
});
