import { describe, expect, it } from "vitest";
import { parseVariantSpec } from "./variantSpec";

describe("parseVariantSpec", () => {
    it("takes a bare name as no override", () => {
        expect(parseVariantSpec("current")).toEqual({ name: "current" });
    });

    it("splits name@provider:model, keeping colons and slashes in the model", () => {
        expect(parseVariantSpec("current@openai:gpt-4o")).toEqual({ name: "current", override: { provider: "openai", model: "gpt-4o" } });
        expect(parseVariantSpec("current@deepseek:org/model:v2")).toEqual({ name: "current", override: { provider: "deepseek", model: "org/model:v2" } });
    });

    it("accepts the open-model host as a provider", () => {
        expect(parseVariantSpec("plain@open:meta-llama/Llama-3-70b")).toEqual({ name: "plain", override: { provider: "open", model: "meta-llama/Llama-3-70b" } });
    });

    it("rejects an unknown provider, a missing model or a missing name", () => {
        expect(() => parseVariantSpec("current@llama:x")).toThrow(/provider/);
        expect(() => parseVariantSpec("current@openai:")).toThrow(/model/);
        expect(() => parseVariantSpec("current@openai")).toThrow(/provider:model/);
        expect(() => parseVariantSpec("@openai:gpt-4o")).toThrow(/name/);
    });
});
