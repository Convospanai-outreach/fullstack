// A variant given on the command line: "name" or "name@provider:model", for example
// "current@openai:gpt-4o". The part after @ pins the LLM the variant's generation runs on.

const PROVIDERS = ["gemini", "openai", "anthropic", "deepseek"] as const;
type Provider = (typeof PROVIDERS)[number];

export interface VariantSpec {
    name: string;
    override?: { provider: Provider; model: string };
}

export function parseVariantSpec(spec: string): VariantSpec {
    const at = spec.indexOf("@");
    const name = (at === -1 ? spec : spec.slice(0, at)).trim();
    if (!name) throw new Error(`Variant "${spec}": a name is required.`);
    if (at === -1) return { name };

    const rest = spec.slice(at + 1);
    const colon = rest.indexOf(":");
    if (colon === -1) throw new Error(`Variant "${spec}": use name@provider:model.`);
    const provider = rest.slice(0, colon).trim();
    const model = rest.slice(colon + 1).trim();
    if (!(PROVIDERS as readonly string[]).includes(provider)) throw new Error(`Variant "${spec}": provider must be one of ${PROVIDERS.join(", ")}.`);
    if (!model) throw new Error(`Variant "${spec}": a model is required.`);
    return { name, override: { provider: provider as Provider, model } };
}
