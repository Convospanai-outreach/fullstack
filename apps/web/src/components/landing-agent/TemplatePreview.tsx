import type { TemplatePreviewLayout } from "./landingTemplateGallery";

// A static mini preview of a template, drawn with boxes in the template's accent colour.
// No images are loaded, so the gallery makes no requests beyond the page itself.
export default function TemplatePreview({ accent, layout }: { accent: string; layout: TemplatePreviewLayout }) {
    const hero = layout.hero;
    const side = hero === "image-side";
    const bullets = Math.min(layout.bullets, 3);

    return (
        <div aria-hidden="true" className="space-y-2 rounded-lg border border-white/10 bg-slate-950/60 p-3">
            {hero === "image-background" && (
                <div className="h-20 rounded" style={{ background: `linear-gradient(135deg, ${accent}, #0f172a)` }} />
            )}
            {hero === "image-top" && <div className="h-16 rounded opacity-80" style={{ background: accent }} />}
            <div className={side ? "flex gap-2" : "space-y-2"}>
                {side && <div className="h-16 w-1/2 rounded" style={{ background: accent }} />}
                <div className={side ? "w-1/2 space-y-2" : "space-y-2"}>
                    <div className="h-2 w-[70%] rounded bg-slate-500/60" />
                    <div className="h-2 w-[90%] rounded bg-slate-500/60" />
                    <div className="h-2 w-1/2 rounded bg-slate-500/60" />
                    <div className="h-5 w-24 rounded-full" style={{ background: accent }} />
                </div>
            </div>
            {bullets > 0 && (
                <div className="space-y-1">
                    {Array.from({ length: bullets }, (_, i) => (
                        <div key={i} className="h-1.5 w-3/4 rounded bg-slate-500/40" />
                    ))}
                </div>
            )}
            {layout.hasForm && <div className="h-6 rounded border border-dashed border-slate-400/60" />}
        </div>
    );
}
