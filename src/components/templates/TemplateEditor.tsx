"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface Template {
    id?: string | undefined;
    name: string;
    subject: string;
    body: string;
}

interface TemplateEditorProps {
    template?: Template;
    onSave: (template: Template) => void;
    onCancel: () => void;
}

export default function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
    const [name, setName] = useState(template?.name || "");
    const [subject, setSubject] = useState(template?.subject || "");
    const [body, setBody] = useState(template?.body || "");

    useEffect(() => {
        if (template) {
            setName(template.name);
            setSubject(template.subject);
            setBody(template.body);
        }
    }, [template]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            id: template?.id,
            name,
            subject,
            body,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Template Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="e.g., Initial Outreach"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Subject Line</label>
                <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="Subject..."
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email Body</label>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 h-64"
                    placeholder="Hi {{firstName}}, ..."
                    required
                />
                <p className="text-xs text-gray-500 mt-1">Variables: {"{{firstName}}"}, {"{{company}}"}, {"{{jobTitle}}"}</p>
            </div>

            <div className="flex justify-end">
                <Button type="button" variant="outline" className="text-xs py-1 px-2 border border-purple-500/50 text-purple-300 hover:bg-purple-500/10" onClick={async () => {
                    // Quick inline implementation for MVP, ideally move to a handler
                    if (!body) return;
                    // We need to call an API endpoint that calls AIService.improveEmail
                    // For now, let's assume we have a client-side helper or new API route.
                    // Let's use a quick fetch to a new endpoint /api/ai/improve
                    try {
                        const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/ai/improve", {
                            method: "POST",
                            body: JSON.stringify({ text: body })
                        });
                        const data = await res.json();
                        if (data.improved) setBody(data.improved);
                    } catch (e) {
                        console.error("AI Improve failed", e);
                    }
                }}>
                    ✨ Improve with AI
                </Button>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={onCancel} className="px-4 py-2">
                    Cancel
                </Button>
                <Button type="submit" variant="default" className="px-4 py-2">
                    Save Template
                </Button>
            </div>
        </form>
    );
}
