import { getTestimonials } from "@/lib/testimonials";

export function Testimonials() {
    const testimonials = getTestimonials();
    if (testimonials.length === 0) return null;

    return (
        <section className="mt-16">
            <h2 className="text-2xl font-bold mb-6">What customers say</h2>
            <div className="grid gap-6 md:grid-cols-2">
                {testimonials.map((t) => (
                    <figure key={t.slug} className="rounded-xl border bg-card p-6">
                        <blockquote className="text-muted-foreground">{t.quote}</blockquote>
                        <figcaption className="mt-4 text-sm font-semibold">
                            {t.name}
                            {(t.role || t.company) && (
                                <span className="font-normal text-muted-foreground">
                                    {" "}
                                    {[t.role, t.company].filter(Boolean).join(", ")}
                                </span>
                            )}
                        </figcaption>
                    </figure>
                ))}
            </div>
        </section>
    );
}
