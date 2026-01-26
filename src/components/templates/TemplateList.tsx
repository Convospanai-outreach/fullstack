"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

interface Template {
    id: string;
    name: string;
    subject: string;
    body: string;
}

interface TemplateListProps {
    templates: Template[];
    onSelect: (template: Template) => void;
    onDelete: (id: string) => void;
    onCreate: () => void;
}

export default function TemplateList({ templates, onSelect, onDelete, onCreate }: TemplateListProps) {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Email Templates</h3>
                <Button onClick={onCreate} variant="primary" className="px-3 py-1 text-sm">
                    + New Template
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {templates.map((template) => (
                    <GlassCard key={template.id} className="p-4 hover:bg-white/5 transition-colors cursor-pointer group relative" onClick={() => onSelect(template)}>
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-medium text-white">{template.name}</h4>
                                <p className="text-sm text-gray-400 mt-1 truncate w-64">{template.subject}</p>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(template.id);
                                }}
                                className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                Delete
                            </button>
                        </div>
                    </GlassCard>
                ))}

                {templates.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                        No templates found. Create one to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
