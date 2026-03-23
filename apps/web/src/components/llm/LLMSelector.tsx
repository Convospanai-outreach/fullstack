"use client";

import { Sparkles, Zap, Brain, Terminal } from 'lucide-react';

interface LLMSelectorProps {
    value: string;
    onChange: (value: string) => void;
}

const MODELS = [
    { id: 'gemini', name: 'Gemini 1.5 Pro', icon: Sparkles, desc: 'Fast, multimodal, high context', color: 'text-blue-400' },
    { id: 'gpt-4o', name: 'GPT-4o', icon: Zap, desc: 'Highest intelligence tier', color: 'text-green-400' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus', icon: Brain, desc: 'Superior nuanced reasoning', color: 'text-orange-400' },
    { id: 'local-mistral', name: 'Local Mistral', icon: Terminal, desc: 'Private, secure inference', color: 'text-slate-400' },
];

export function LLMSelector({ value, onChange }: LLMSelectorProps) {
    return (
        <div className="grid grid-cols-1 gap-3">
            {MODELS.map((model) => {
                const Icon = model.icon;
                const isSelected = value === model.id;

                return (
                    <button
                        key={model.id}
                        onClick={() => onChange(model.id)}
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${isSelected
                            ? 'bg-accent-blue/10 border-accent-blue ring-1 ring-accent-blue'
                            : 'bg-white/5 border-border-subtle hover:border-white/20'
                            }`}
                    >
                        <div className={`p-2 rounded-lg bg-black/40 ${model.color}`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <span className="font-semibold text-white">{model.name}</span>
                                {isSelected && (
                                    <span className="text-[10px] font-bold uppercase tracking-widest bg-accent-blue text-white px-1.5 py-0.5 rounded">Active</span>
                                )}
                            </div>
                            <p className="text-xs text-text-secondary mt-0.5">{model.desc}</p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
