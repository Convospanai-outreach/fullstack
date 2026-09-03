"use client";
import { useState } from "react";

interface AIConfig {
    tone: string;
    goal: string;
    context: string;
    prompt: string;
}

interface SmartCampaignFormProps {
    config: AIConfig;
    onChange: (config: AIConfig) => void;
    onGeneratePreview: () => Promise<string>;
}

export default function SmartCampaignForm({ config, onChange, onGeneratePreview }: SmartCampaignFormProps) {
    const [preview, setPreview] = useState("");
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const result = await onGeneratePreview();
            setPreview(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm text-muted-foreground mb-1">Tone</label>
                    <select
                        className="w-full bg-muted border border-border rounded-lg p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={config.tone}
                        onChange={(e) => onChange({ ...config, tone: e.target.value })}
                    >
                        <option value="Professional">Professional</option>
                        <option value="Casual">Casual</option>
                        <option value="Persuasive">Persuasive</option>
                        <option value="Friendly">Friendly</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-muted-foreground mb-1">Goal</label>
                    <select
                        className="w-full bg-muted border border-border rounded-lg p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={config.goal}
                        onChange={(e) => onChange({ ...config, goal: e.target.value })}
                    >
                        <option value="Introduction">Introduction</option>
                        <option value="Meeting Request">Meeting Request</option>
                        <option value="Follow Up">Follow Up</option>
                        <option value="Engagement">Engagement</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm text-muted-foreground mb-1">Context / Details</label>
                <textarea
                    className="w-full bg-muted border border-border rounded-lg p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 h-24"
                    placeholder="E.g., We are launching a new AI tool for sales teams..."
                    value={config.context}
                    onChange={(e) => onChange({ ...config, context: e.target.value })}
                />
            </div>

            <div>
                <label className="block text-sm text-muted-foreground mb-1">Custom Prompt Instructions (Optional)</label>
                <textarea
                    className="w-full bg-muted border border-border rounded-lg p-3 text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500 h-24"
                    placeholder="Additional instructions for the AI..."
                    value={config.prompt}
                    onChange={(e) => onChange({ ...config, prompt: e.target.value })}
                />
            </div>

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={loading}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                    {loading ? "Generating..." : "Generate Preview"}
                </button>
            </div>

            {preview && (
                <div className="bg-muted border border-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-purple-600 mb-2">AI Preview</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">{preview}</p>
                </div>
            )}
        </div>
    );
}
