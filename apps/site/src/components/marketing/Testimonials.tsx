import { getTestimonials } from "@/lib/testimonials";
import { Section } from "@/components/marketing/site/kit";

/** Real quotes from the CMS (content/testimonials). Renders nothing while there are none. */
export function Testimonials() {
    const testimonials = getTestimonials();
    if (testimonials.length === 0) return null;
    return (
        <Section tone="beige" title="What customers say">
            <div className="ph-grid ph-grid-2">
                {testimonials.map((t) => (
                    <figure key={t.slug} className="ph-card" style={{ margin: 0 }}>
                        <blockquote style={{ margin: 0, fontSize: 20, lineHeight: 1.4, fontWeight: 500 }}>“{t.quote}”</blockquote>
                        <figcaption className="ph-label" style={{ marginTop: 16 }}>{[t.name, t.role, t.company].filter(Boolean).join(", ")}</figcaption>
                    </figure>
                ))}
            </div>
        </Section>
    );
}
