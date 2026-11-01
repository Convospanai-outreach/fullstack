"use client";

import { useEffect, useRef, useState } from "react";
import type { Component, Editor } from "grapesjs";
import { Button } from "@/components/ui/button";
import "grapesjs/dist/css/grapes.min.css";
import "./grapesEditor.css";
import { landingAgentApi } from "@/modules/landing-agent/service/landingAgentApi";
import { LANDING_ASSET_LIBRARY, type LandingAsset } from "@/components/landing-agent/landingAssetLibrary";
import {
    FOCAL_POINTS,
    HERO_IMAGE_LAYOUTS,
    OVERLAY_STRENGTHS,
    buildHeroImageHtml,
    type FocalPoint,
    type HeroImageLayout,
    type OverlayStrength,
} from "@/components/landing-agent/heroImageBlock";
import { imageAltWarnings, imageSourceMessage, type ImageAltWarning } from "@/components/landing-agent/imageSources";
import { getLandingRenderPayload, withLandingBaseCss } from "@/modules/landing-agent/rendering";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "@/modules/landing-agent/leadFormConfig";
import { LEAD_FORM_CANVAS_CSS, leadFormOfSelection, previewLeadFormHtml } from "@/components/landing-agent/leadFormEditor";
import LeadFormSettingsPanel from "@/components/landing-agent/LeadFormSettingsPanel";
import InstagramSettingsPanel from "@/components/landing-agent/InstagramSettingsPanel";
import { instagramFollowOfSelection } from "@/components/landing-agent/instagramFollow";
import CopyHelperPanel from "@/components/landing-agent/CopyHelperPanel";
import { applyCopyToComponent } from "@/components/landing-agent/copyPatterns";
import {
    AUTOSAVE_INTERVAL_MS,
    EDITOR_BLOCKS,
    EDITOR_BRAND_COLORS,
    EDITOR_DEVICES,
    EDITOR_STYLE_PROPERTIES,
    EDITOR_TRAIT_NAMES,
    applyEditorLinkHref,
    canvasBaseCss,
    filterEditorStyle,
    shouldAutosave,
    userCssFromSaved,
    type EditorStyleProperty,
} from "@/components/landing-agent/editorConfig";

interface Props {
    initialRenderedJson?: unknown;
    title?: string;
    pageStatus?: string;
    pageSlug?: string | null;
    onSave: (payload: { title?: string; editorState?: unknown; renderedJson: unknown }) => Promise<void>;
    onPublish: () => Promise<void>;
    onGenerateImages?: () => Promise<unknown>;
}

type DeviceName = (typeof EDITOR_DEVICES)[number]["name"];
type RenderedPage = { html: string; css: string };

function buildPreviewDoc(html: string, css: string): string {
    return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${css}</style></head><body class="la-page">${html}</body></html>`;
}

function toGrapesStyleProperty(prop: EditorStyleProperty) {
    if (prop.kind === "color") {
        return { property: prop.property, type: "color", label: prop.label };
    }
    return {
        property: prop.property,
        type: "select",
        label: prop.label,
        list: prop.options.map((option) => ({ value: option.value, name: option.label })),
    };
}

// Only component styles (#id rules written by the style panel) are checked here.
// Rules the page already had (AI-written CSS) are kept as they are.
function cleanComponentStyles(editor: Editor) {
    for (const rule of editor.Css.getRules()) {
        if (!rule.selectorsToString().startsWith("#")) continue;
        const style = rule.getStyle() as Record<string, unknown>;
        const clean = filterEditorStyle(style);
        if (Object.keys(clean).length !== Object.keys(style).length) {
            rule.setStyle(clean);
        }
    }
}

function readRendered(editor: Editor): RenderedPage {
    cleanComponentStyles(editor);
    return { html: editor.getHtml(), css: withLandingBaseCss(editor.getCss() || "") };
}

// The link trait writes href only for safe values (see isSafeEditorLink).
const linkHrefTrait = {
    name: "href",
    label: "Link (https, mailto, tel or #section)",
    setValue: ({ component, value }: { component: Parameters<typeof applyEditorLinkHref>[0]; value: unknown }) => {
        applyEditorLinkHref(component, value);
    },
};

export default function GrapesEditor({ initialRenderedJson, title, pageStatus, pageSlug, onSave, onPublish, onGenerateImages }: Props) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const blocksRef = useRef<HTMLDivElement | null>(null);
    const layersRef = useRef<HTMLDivElement | null>(null);
    const stylesRef = useRef<HTMLDivElement | null>(null);
    const traitsRef = useRef<HTMLDivElement | null>(null);
    const selectorsRef = useRef<HTMLDivElement | null>(null);
    const editorRef = useRef<Editor | null>(null);
    const persistRef = useRef<(() => Promise<boolean>) | null>(null);
    const refreshRef = useRef<(() => void) | null>(null);
    // The editor mounts once, from the page as it was on first render. Saves refresh
    // the prop, and remounting on each refresh would wipe undo history and selection.
    const initialRef = useRef(initialRenderedJson);
    const onSaveRef = useRef(onSave);
    const pageTitleRef = useRef(title || "Landing Page");
    const savedSnapshotRef = useRef("");
    const dirtyRef = useRef(false);
    const savingRef = useRef(false);

    const [loadingEditor, setLoadingEditor] = useState(true);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [generatingImages, setGeneratingImages] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pageTitle, setPageTitle] = useState(title || "Landing Page");
    const [previewDoc, setPreviewDoc] = useState("");
    const [previewWidth, setPreviewWidth] = useState<"desktop" | "mobile">("desktop");
    const [device, setDevice] = useState<DeviceName>("Desktop");
    const [dirty, setDirty] = useState(false);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [isEmpty, setIsEmpty] = useState(false);
    const [altWarnings, setAltWarnings] = useState<ImageAltWarning[]>([]);
    const [imageSrc, setImageSrc] = useState("");
    const [imageAlt, setImageAlt] = useState("");
    const [imageLayout, setImageLayout] = useState<HeroImageLayout>("background");
    const [imageFocal, setImageFocal] = useState<FocalPoint>("center");
    const [imageDarken, setImageDarken] = useState<OverlayStrength>(40);
    const [imageNote, setImageNote] = useState<string | null>(null);
    const [imageError, setImageError] = useState<string | null>(null);
    const [leadForm, setLeadForm] = useState<{ key: number; config: LeadFormConfig | null } | null>(null);
    const leadFormComponentRef = useRef<Component | null>(null);
    const [instagram, setInstagram] = useState<{ key: number } | null>(null);
    const instagramComponentRef = useRef<Component | null>(null);

    function applyInstagramHref(href: string) {
        const component = instagramComponentRef.current;
        if (!component) return;
        component.addAttributes({ href });
        refreshRef.current?.();
    }

    function applyLeadForm(config: LeadFormConfig) {
        const component = leadFormComponentRef.current;
        if (!component) return;
        component.addAttributes({ id: encodeLeadFormMarkerId(config) });
        refreshRef.current?.();
    }
    const [uploadingImage, setUploadingImage] = useState(false);

    const isPublished = pageStatus === "published";

    useEffect(() => {
        onSaveRef.current = onSave;
    }, [onSave]);

    useEffect(() => {
        let active = true;
        let previewTimer: ReturnType<typeof setTimeout> | null = null;
        let autosaveTimer: ReturnType<typeof setInterval> | null = null;
        let editor: Editor | null = null;

        function refresh() {
            if (!editor || !active) return;
            const rendered = readRendered(editor);
            const payload = getLandingRenderPayload(rendered);
            setPreviewDoc(buildPreviewDoc(previewLeadFormHtml(payload.html), payload.css));
            const nowDirty = JSON.stringify(rendered) !== savedSnapshotRef.current;
            dirtyRef.current = nowDirty;
            setDirty(nowDirty);
            setCanUndo(editor.UndoManager.hasUndo());
            setCanRedo(editor.UndoManager.hasRedo());
            setIsEmpty(editor.getWrapper()?.components().length === 0);
            setAltWarnings(imageAltWarnings(rendered.html));
        }
        refreshRef.current = refresh;

        async function persist(): Promise<boolean> {
            if (!editor || savingRef.current) return false;
            savingRef.current = true;
            setSaving(true);
            setError(null);
            try {
                const rendered = readRendered(editor);
                await onSaveRef.current({
                    title: pageTitleRef.current,
                    editorState: { components: editor.getComponents()?.toJSON?.() || null },
                    renderedJson: rendered,
                });
                savedSnapshotRef.current = JSON.stringify(rendered);
                refresh();
                return true;
            } catch (err: any) {
                if (active) setError(err?.message || "Save failed");
                return false;
            } finally {
                savingRef.current = false;
                if (active) setSaving(false);
            }
        }
        persistRef.current = persist;

        function onKeyDown(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void persist();
            }
        }
        window.addEventListener("keydown", onKeyDown);

        autosaveTimer = setInterval(() => {
            const shouldSave = shouldAutosave({
                dirty: dirtyRef.current,
                saving: savingRef.current,
            });
            if (shouldSave) void persist();
        }, AUTOSAVE_INTERVAL_MS);

        async function mountEditor() {
            const container = containerRef.current;
            const blocksEl = blocksRef.current;
            const layersEl = layersRef.current;
            const stylesEl = stylesRef.current;
            const traitsEl = traitsRef.current;
            const selectorsEl = selectorsRef.current;
            if (!container || !blocksEl || !layersEl || !stylesEl || !traitsEl || !selectorsEl) return;
            const grapes = await import("grapesjs");
            if (!active) return;

            const created = grapes.default.init({
                container,
                fromElement: false,
                width: "auto",
                height: "70vh",
                storageManager: false,
                cssIcons: "",
                protectedCss: "",
                avoidInlineStyle: true,
                panels: { defaults: [] },
                deviceManager: { devices: EDITOR_DEVICES.map((d) => ({ ...d })) },
                richTextEditor: { actions: ["bold", "italic", "link"] },
                colorPicker: { palette: [[...EDITOR_BRAND_COLORS]], showPalette: true, showInput: true, preferredFormat: "hex" },
                selectorManager: { componentFirst: true, appendTo: selectorsEl },
                blockManager: { appendTo: blocksEl },
                layerManager: { appendTo: layersEl },
                traitManager: { appendTo: traitsEl },
                styleManager: {
                    appendTo: stylesEl,
                    sectors: [{ name: "Look", open: true, properties: EDITOR_STYLE_PROPERTIES.map(toGrapesStyleProperty) }],
                },
            });
            editor = created;
            editorRef.current = created;

            created.DomComponents.addType("link", {
                model: { defaults: { traits: EDITOR_TRAIT_NAMES.map((name) => (name === "href" ? linkHrefTrait : name)) } },
            });
            for (const block of EDITOR_BLOCKS) {
                created.BlockManager.add(block.id, { label: block.label, category: "Landing", content: block.content });
            }

            created.on("component:selected", (component: Component) => {
                // The id carries a lead form's configuration and anchors like #lead-form, so it is not editable here.
                component.removeTrait("id");
                const classes = component.getClasses().map((c) => String(c));
                const selection = leadFormOfSelection({ id: String(component.getAttributes()["id"] ?? ""), classes });
                leadFormComponentRef.current = selection ? component : null;
                setLeadForm(selection ? { key: Date.now(), config: selection.config } : null);
                const isInstagram = instagramFollowOfSelection(classes);
                instagramComponentRef.current = isInstagram ? component : null;
                setInstagram(isInstagram ? { key: Date.now() } : null);
            });
            created.on("component:deselected", () => {
                leadFormComponentRef.current = null;
                setLeadForm(null);
                instagramComponentRef.current = null;
                setInstagram(null);
            });

            created.onReady(() => {
                if (!active) return;
                created.getWrapper()?.addAttributes({ class: "la-page" });
                const frameDoc = created.Canvas.getDocument();
                if (frameDoc) {
                    const base = frameDoc.createElement("style");
                    base.setAttribute("data-landing-base", "");
                    base.textContent = canvasBaseCss();
                    frameDoc.head.appendChild(base);
                    const leadFormStyle = frameDoc.createElement("style");
                    leadFormStyle.textContent = LEAD_FORM_CANVAS_CSS;
                    frameDoc.head.appendChild(leadFormStyle);
                }
                const initial = getLandingRenderPayload(initialRef.current);
                created.setComponents(initial.html);
                created.setStyle(userCssFromSaved(initial.css));
                savedSnapshotRef.current = JSON.stringify(readRendered(created));
                setLoadingEditor(false);
                refresh();
                created.on("update", () => {
                    if (previewTimer) clearTimeout(previewTimer);
                    previewTimer = setTimeout(refresh, 400);
                });
            });
        }

        mountEditor().catch((err) => {
            setError(err?.message || "Failed to load GrapesJS");
            setLoadingEditor(false);
        });

        return () => {
            active = false;
            if (previewTimer) clearTimeout(previewTimer);
            if (autosaveTimer) clearInterval(autosaveTimer);
            window.removeEventListener("keydown", onKeyDown);
            try {
                editor?.destroy();
            } catch {
                // ignore editor cleanup errors
            }
            editorRef.current = null;
            persistRef.current = null;
            refreshRef.current = null;
        };
    }, []);

    async function handleSave() {
        await persistRef.current?.();
    }

    async function handlePublish() {
        setPublishing(true);
        setError(null);
        try {
            // Publish only what was saved: if the save fails, stop here.
            const saved = await persistRef.current?.();
            if (saved === false) return;
            await onPublish();
        } catch (err: any) {
            setError(err?.message || "Publish failed");
        } finally {
            setPublishing(false);
        }
    }

    function handleDevice(name: DeviceName) {
        setDevice(name);
        editorRef.current?.setDevice(name);
    }

    function handleUndo() {
        editorRef.current?.UndoManager.undo();
        refreshRef.current?.();
    }

    function handleRedo() {
        editorRef.current?.UndoManager.redo();
        refreshRef.current?.();
    }

    function handlePreviewInNewTab() {
        if (!pageSlug) return;
        window.open(`/p/${pageSlug}`, "_blank", "noopener,noreferrer");
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
                refreshRef.current?.();
            }
        } catch (err: any) {
            setError(err?.message || "Image generation failed");
        } finally {
            setGeneratingImages(false);
        }
    }

    async function handleImageUpload(file: File | undefined) {
        if (!file) return;
        setUploadingImage(true);
        setImageError(null);
        try {
            const { url } = await landingAgentApi.uploadImage(file);
            setImageSrc(url);
            setImageNote("Uploaded to your landing images.");
        } catch (err: any) {
            setImageError(err?.message || "Image upload failed");
        } finally {
            setUploadingImage(false);
        }
    }

    function handlePastedImage(value: string) {
        const message = imageSourceMessage(value);
        setImageSrc(value);
        setImageError(message.error);
        setImageNote(message.note);
    }

    function handleLibraryImage(asset: LandingAsset) {
        // Absolute, so the image also loads on pages served from a customer's own domain.
        setImageSrc(window.location.protocol === "https:" ? new URL(asset.path, window.location.origin).toString() : asset.path);
        setImageAlt((current) => (current.trim() ? current : asset.alt));
        setImageError(null);
        setImageNote("Built-in image.");
    }

    // Writes a helper pattern into the selected text block. False when no text block is selected.
    function handleUseCopy(text: string): boolean {
        const applied = applyCopyToComponent(editorRef.current?.getSelected(), text);
        if (applied) refreshRef.current?.();
        return applied;
    }

    function handleAddImage() {
        const html = buildHeroImageHtml({ layout: imageLayout, src: imageSrc, alt: imageAlt, focal: imageFocal, darken: imageDarken });
        if (!html) {
            setImageError("Add alt text and an https image address before adding the image.");
            return;
        }
        editorRef.current?.addComponents(html);
        refreshRef.current?.();
    }

    const saveLabel = saving
        ? "Saving..."
        : dirty
          ? isPublished
              ? "Unsaved changes. Saves a draft every 10 seconds. Publish to update the live page."
              : "Unsaved changes. Saves automatically every 10 seconds."
          : "All changes saved";

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <input
                    type="text"
                    value={pageTitle}
                    onChange={(e) => {
                        pageTitleRef.current = e.target.value;
                        setPageTitle(e.target.value);
                    }}
                    className="min-w-72 rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-slate-100"
                    placeholder="Landing page title"
                />
                <Button onClick={handleSave} disabled={saving || publishing} className="bg-white text-slate-900 hover:bg-slate-200">
                    {saving ? "Saving..." : "Save Draft"}
                </Button>
                <Button onClick={handleUndo} disabled={!canUndo} className="bg-white/10 text-slate-200 hover:bg-white/20">
                    Undo
                </Button>
                <Button onClick={handleRedo} disabled={!canRedo} className="bg-white/10 text-slate-200 hover:bg-white/20">
                    Redo
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
                <Button
                    onClick={handlePreviewInNewTab}
                    disabled={!isPublished || !pageSlug}
                    title={isPublished ? "Open the live page in a new tab" : "Publish the page to preview it"}
                    className="bg-white/10 text-slate-200 hover:bg-white/20"
                >
                    Preview in new tab
                </Button>
                <p className="text-xs text-slate-400">{saveLabel}</p>
            </div>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            {altWarnings.length > 0 ? (
                <div className="space-y-1 rounded-lg border border-amber-400/40 bg-amber-950/30 p-3 text-sm text-amber-200">
                    <p>
                        {altWarnings.length} image{altWarnings.length === 1 ? "" : "s"} without alt text. Screen readers cannot describe
                        {altWarnings.length === 1 ? " it" : " them"}.
                    </p>
                    <ul className="list-disc pl-5 text-xs">
                        {altWarnings.map((warning, index) => (
                            <li key={index}>
                                {warning.src ?? "Image"}: {warning.problem === "missing" ? "no alt attribute" : "alt text is empty"}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_280px]">
                <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Blocks</p>
                        <div ref={blocksRef} />
                    </div>
                    <CopyHelperPanel onUse={handleUseCopy} />
                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-3">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Images</p>
                        <label className="block text-xs text-slate-300">
                            Upload (PNG, JPG or WebP, 2 MB max)
                            <input
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                disabled={uploadingImage}
                                onChange={(e) => {
                                    void handleImageUpload(e.target.files?.[0]);
                                    e.target.value = "";
                                }}
                                className="mt-1 block w-full text-xs text-slate-300"
                            />
                        </label>
                        <label className="block text-xs text-slate-300">
                            Or paste an https image address
                            <input
                                type="url"
                                value={imageSrc}
                                onChange={(e) => handlePastedImage(e.target.value)}
                                placeholder="https://"
                                className="mt-1 w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-slate-100"
                            />
                        </label>
                        <div className="grid grid-cols-4 gap-1">
                            {LANDING_ASSET_LIBRARY.map((asset) => (
                                <button
                                    key={asset.id}
                                    type="button"
                                    title={asset.label}
                                    onClick={() => handleLibraryImage(asset)}
                                    className="h-10 overflow-hidden rounded border border-white/10"
                                >
                                    <img src={asset.path} alt={asset.alt} className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                        <label className="block text-xs text-slate-300">
                            Alt text (required)
                            <input
                                type="text"
                                value={imageAlt}
                                onChange={(e) => setImageAlt(e.target.value)}
                                className="mt-1 w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-slate-100"
                            />
                        </label>
                        <label className="block text-xs text-slate-300">
                            Layout
                            <select
                                value={imageLayout}
                                onChange={(e) => setImageLayout(e.target.value as HeroImageLayout)}
                                className="mt-1 w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-slate-100"
                            >
                                {HERO_IMAGE_LAYOUTS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="block text-xs text-slate-300">
                                Focus
                                <select
                                    value={imageFocal}
                                    onChange={(e) => setImageFocal(e.target.value as FocalPoint)}
                                    className="mt-1 w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-slate-100"
                                >
                                    {FOCAL_POINTS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="block text-xs text-slate-300">
                                Darken
                                <select
                                    value={imageDarken}
                                    onChange={(e) => setImageDarken(Number(e.target.value) as OverlayStrength)}
                                    className="mt-1 w-full rounded border border-white/10 bg-slate-900/60 px-2 py-1 text-slate-100"
                                >
                                    {OVERLAY_STRENGTHS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        {imageNote ? <p className="text-xs text-slate-400">{imageNote}</p> : null}
                        {imageError ? <p className="text-xs text-rose-300">{imageError}</p> : null}
                        <Button
                            onClick={handleAddImage}
                            disabled={!imageAlt.trim() || !imageSrc.trim() || uploadingImage}
                            className="w-full bg-white/10 text-slate-200 hover:bg-white/20"
                        >
                            Add image block
                        </Button>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Layers</p>
                        <div ref={layersRef} />
                    </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-400">
                            Double-click text to edit. Ctrl+Z undo, Ctrl+Shift+Z redo, Ctrl+S save.
                        </p>
                        <div className="flex gap-1">
                            {EDITOR_DEVICES.map((option) => (
                                <Button
                                    key={option.name}
                                    onClick={() => handleDevice(option.name)}
                                    className={`h-7 px-2 text-xs ${device === option.name ? "bg-cyan-600 text-white" : "bg-white/10 text-slate-300"}`}
                                >
                                    {option.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                    {loadingEditor ? <p className="p-6 text-sm text-slate-400">Loading editor...</p> : null}
                    {!loadingEditor && isEmpty ? (
                        <p className="p-6 text-sm text-slate-400">This page is empty. Click a block on the left to add it.</p>
                    ) : null}
                    <div ref={containerRef} />
                </div>

                <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Style</p>
                        <div ref={stylesRef} />
                    </div>
                    <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Link settings</p>
                        <div ref={traitsRef} />
                    </div>
                    {leadForm ? (
                        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Lead form</p>
                            <LeadFormSettingsPanel key={leadForm.key} config={leadForm.config} onApply={applyLeadForm} />
                        </div>
                    ) : null}
                    {instagram ? (
                        <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Instagram follow</p>
                            <InstagramSettingsPanel key={instagram.key} onApply={applyInstagramHref} />
                        </div>
                    ) : null}
                    <div className="hidden" ref={selectorsRef} />
                </div>
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
    );
}
