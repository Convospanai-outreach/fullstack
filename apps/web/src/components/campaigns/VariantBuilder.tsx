"use client";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";

interface Variant {
    id: string;
    subject: string;
    body: string;
    weight: number;
}

interface VariantBuilderProps {
    variants: Variant[];
    onChange: (variants: Variant[]) => void;
}

export default function VariantBuilder({ variants, onChange }: VariantBuilderProps) {
    const addVariant = () => {
        const newVariant: Variant = {
            id: crypto.randomUUID(),
            subject: "",
            body: "",
            weight: 50,
        };
        onChange([...variants, newVariant]);
    };

    const updateVariant = (id: string, field: keyof Variant, value: string | number) => {
        const updated = variants.map((v) =>
            v.id === id ? { ...v, [field]: value } : v
        );
        onChange(updated);
    };

    const removeVariant = (id: string) => {
        onChange(variants.filter((v) => v.id !== id));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">A/B Test Variants</h3>
                <Button onClick={addVariant} variant="outline" className="px-3 py-1 text-sm">
                    + Add Variant
                </Button>
            </div>

            {variants.map((variant, index) => (
                <GlassCard key={variant.id} className="p-4 space-y-4 relative">
                    <div className="absolute top-2 right-2">
                        <button
                            onClick={() => removeVariant(variant.id)}
                            className="text-gray-400 hover:text-red-400"
                        >
                            &times;
                        </button>
                    </div>
                    <h4 className="text-sm font-medium text-gray-300">Variant {String.fromCharCode(65 + index)}</h4>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Subject</label>
                        <input
                            type="text"
                            value={variant.subject}
                            onChange={(e) => updateVariant(variant.id, "subject", e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                            placeholder="Email Subject"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Body</label>
                        <textarea
                            value={variant.body}
                            onChange={(e) => updateVariant(variant.id, "body", e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 h-24"
                            placeholder="Message Body..."
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Traffic Weight (%)</label>
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={variant.weight}
                            onChange={(e) => updateVariant(variant.id, "weight", parseInt(e.target.value))}
                            className="w-24 bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </GlassCard>
            ))}
        </div>
    );
}
