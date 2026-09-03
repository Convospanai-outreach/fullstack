"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LANDING_PAGE_BASE_CSS, getLandingRenderPayload, withLandingBaseCss } from "@/modules/landing-agent/rendering";

interface Props {
    initialRenderedJson?: unknown;
    title?: string;
    onSave: (payload: { title?: string; editorState?: unknown; renderedJson: unknown }) => Promise<void>;
    onPublish: () => Promise<void>;
    onGenerateImages?: () => Promise<unknown>;
}

function getInitialHtml(initialRenderedJson: unknown): string {
    return getLandingRenderPayload(initialRenderedJson).html;
}

function buildPreviewDoc(html: string, css: string): string {
    return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${css}</style></head><body class="la-page">${html}</body></html>`;
}

export default function GrapesEditor({ initialRenderedJson, title, onSave, onPublish, onGenerateImages }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<any>(null);
    const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [loadingEditor, setLoadingEditor] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [generatingImages, setGeneratingImages] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pageTitle, setPageTitle] = useState(title || "Landing Page");
    const [previewDoc, setPreviewDoc] = useState("");
    const [previewWidth, setPreviewWidth] = useState<"desktop" | "mobile">("desktop");

    const starterHtml = useMemo(() => getInitialHtml(initialRenderedJson), [initialRenderedJson]);

    function updatePreviewFromEditor() {
        if (!editorRef.current) return;
        const html = editorRef.current.getHtml();
        const css = withLandingBaseCss(editorRef.current.getCss() || "");
        const payload = getLandingRenderPayload({ html, css });
        setPreviewDoc(buildPreviewDoc(payload.html, payload.css));
    }

    useEffect(() => {
        let active = true;

        async function mountEditor() {
            if (!containerRef.current) return;
            const grapes = await import("grapesjs");
            if (!active || !containerRef.current) return;

            const editor = grapes.default.init({
                container: containerRef.current,
                fromElement: false,
                width: "auto",
                height: "70vh",
                storageManager: false,
                canvas: {
                    styles: [
                        "body{font-family:system-ui,Segoe UI,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;}",
                        ".landing-section{max-width:920px;margin:0 auto 24px auto;padding:20px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;}",
                        ".hero{border-color:#38bdf8;background:#ecfeff;}",
                        ".cta{border-color:#f59e0b;background:#fffbeb;}",
                    ],
                },
            });

            editor.setStyle(LANDING_PAGE_BASE_CSS);
            editor.BlockManager.add("hero", {
                label: "Hero",
                category: "Landing",
                content: `
                    <section class="landing-section hero">
                        <h1>Primary headline</h1>
                        <p>Core value proposition for your audience.</p>
                        <button>Book a demo</button>
                    </section>
                `,
            });
            editor.BlockManager.add("challenge_solution", {
                label: "Challenge/Solution",
                category: "Landing",
                content: `
                    <section class="landing-section">
                        <h2>Challenge</h2>
                        <p>Describe buyer pain clearly.</p>
                        <h3>Solution</h3>
                        <p>Explain why your approach is practical.</p>
                    </section>
                `,
            });
            editor.BlockManager.add("benefits", {
                label: "Benefits",
                category: "Landing",
                content: `
                    <section class="landing-section">
                        <h2>Benefits</h2>
                        <ul>
                            <li>Benefit one</li>
                            <li>Benefit two</li>
                            <li>Benefit three</li>
                        </ul>
                    </section>
                `,
            });
            editor.BlockManager.add("cta_form", {
                label: "CTA Form",
                category: "Landing",
                content: `
                    <section class="landing-section cta">
                        <h2>Talk to our team</h2>
                        <p>We will reach out within one business day.</p>
                        <form>
                            <input type="text" placeholder="Name" />
                            <input type="email" placeholder="Work Email" />
                            <button type="submit">Submit</button>
                        </form>
                    </section>
                `,
            });

            editor.setComponents(starterHtml);
            editorRef.current = editor;
            setLoadingEditor(false);
            updatePreviewFromEditor();

            editor.on("update", () => {
                if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
                previewDebounceRef.current = setTimeout(updatePreviewFromEditor, 400);
            });
        }

        mountEditor().catch((err) => {
            setError(err?.message || "Failed to load GrapesJS");
            setLoadingEditor(false);
        });

        return () => {
            active = false;
            if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
            try {
                editorRef.current?.destroy();
            } catch {
                // ignore editor cleanup errors
            }
            editorRef.current = null;
        };
    }, [starterHtml]);

    async function handleSave() {
        if (!editorRef.current) return;
        setSaving(true);
        setError(null);

        try {
            const html = editorRef.current.getHtml();
            const css = withLandingBaseCss(editorRef.current.getCss() || "");
            const componentsJson = editorRef.current.getComponents()?.toJSON?.() || null;
            await onSave({
                title: pageTitle,
                editorState: {
                    components: componentsJson,
                },
                renderedJson: {
                    html,
                    css,
                },
            });
        } catch (err: any) {
            setError(err?.message || "Save failed");
        } finally {
            setSaving(false);
        }
    }

    async function handlePublish() {
        setPublishing(true);
        setError(null);
        try {
            await handleSave();
            await onPublish();
        } catch (err: any) {
            setError(err?.message || "Publish failed");
        } finally {
            setPublishing(false);
        }
    }

    async function handleGenerateImages() {
        if (!onGenerateImages || !editorRef.current) return;
        setGeneratingImages(true);
        setError(null);
        try {
            const updatedRenderedJson = await onGenerateImages();
            if (updatedRenderedJson) {
                const html = getLandingRenderPayload(updatedRenderedJson).html;
                editorRef.current.setComponents(html);
                updatePreviewFromEditor();
            }
        } catch (err: any) {
            setError(err?.message || "Image generation failed");
        } finally {
            setGeneratingImages(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="text"
                    value={pageTitle}
                    onChange={(e) => setPageTitle(e.target.value)}
                    className="min-w-72 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-slate-100"
                    placeholder="Landing page title"
                />
                <Button onClick={handleSave} disabled={saving || publishing} className="bg-white text-slate-900 hover:bg-slate-200">
                    {saving ? "Saving..." : "Save Draft"}
                </Button>
                {onGenerateImages ? (
                    <Button
                        onClick={handleGenerateImages}
                        disabled={generatingImages || saving || publishing}
                        className="bg-violet-600 hover:bg-violet-500 text-white"
                    >
                        {generatingImages ? "Generating images..." : "Generate images"}
                    </Button>
                ) : null}
                <Button onClick={handlePublish} disabled={publishing} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                    {publishing ? "Publishing..." : "Publish"}
                </Button>
            </div>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2">
                    {loadingEditor ? <p className="p-6 text-sm text-slate-400">Loading editor...</p> : null}
                    <div ref={containerRef} />
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Live Preview</p>
                        <div className="flex gap-1">
                            <Button
                                onClick={() => setPreviewWidth("desktop")}
                                className={`h-7 px-2 text-xs ${previewWidth === "desktop" ? "bg-cyan-600 text-white" : "bg-white/10 text-slate-300"}`}
                            >
                                Desktop
                            </Button>
                            <Button
                                onClick={() => setPreviewWidth("mobile")}
                                className={`h-7 px-2 text-xs ${previewWidth === "mobile" ? "bg-cyan-600 text-white" : "bg-white/10 text-slate-300"}`}
                            >
                                Mobile
                            </Button>
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2" style={{ height: "70vh" }}>
                        <iframe
                            title="Landing page preview"
                            srcDoc={previewDoc}
                            sandbox=""
                            className="h-full rounded-lg bg-white"
                            style={{ width: previewWidth === "desktop" ? "100%" : "390px", margin: previewWidth === "mobile" ? "0 auto" : undefined, display: "block" }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
