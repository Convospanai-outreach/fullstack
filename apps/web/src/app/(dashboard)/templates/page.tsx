"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import TemplateList from "@/components/templates/TemplateList";
import TemplateEditor from "@/components/templates/TemplateEditor";
import { getBrowserApiBase } from "@/lib/api/browserBase";

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState<any>(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await fetch(getBrowserApiBase() + "/templates");
            const data = await res.json();
            setTemplates(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch templates", error);
        } finally {

        }
    };

    const handleSave = async (template: any) => {
        try {
            const method = template.id ? "PUT" : "POST";
            const url = template.id ? `${getBrowserApiBase()}/templates/${template.id}` : getBrowserApiBase() + "/templates";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(template)
            });

            if (res.ok) {
                setIsEditing(false);
                setCurrentTemplate(null);
                fetchTemplates();
            }
        } catch (error) {
            console.error("Failed to save template", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this template?")) return;
        try {
            await fetch(`${getBrowserApiBase()}/templates/${id}`, { method: "DELETE" });
            fetchTemplates();
        } catch (error) {
            console.error("Failed to delete template", error);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <SectionHeader
                title="Email Templates"
                subtitle="Manage reusable campaign templates, then refine language, audience fit, and PPT narrative in Studio."
            />

            <div className="rounded-lg border border-border/50 bg-card px-5 py-4 text-sm text-muted-foreground">
                Need an international campaign brief or editable presentation outline?
                {" "}
                <Link href="/studio" className="text-primary hover:underline transition font-medium">
                    Open International Campaign Studio
                </Link>
                {" "}
                to adjust language, target audience, regional tone, and slide structure.
            </div>

            {isEditing ? (
                <div className="max-w-2xl">
                    <h3 className="text-lg font-semibold text-white mb-4">
                        {currentTemplate ? "Edit Template" : "New Template"}
                    </h3>
                    <TemplateEditor
                        template={currentTemplate}
                        onSave={handleSave}
                        onCancel={() => {
                            setIsEditing(false);
                            setCurrentTemplate(null);
                        }}
                    />
                </div>
            ) : (
                <TemplateList
                    templates={templates}
                    onSelect={(t) => {
                        setCurrentTemplate(t);
                        setIsEditing(true);
                    }}
                    onDelete={handleDelete}
                    onCreate={() => {
                        setCurrentTemplate(null);
                        setIsEditing(true);
                    }}
                />
            )}
        </div>
    );
}
