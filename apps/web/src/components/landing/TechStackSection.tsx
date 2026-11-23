

export default function TechStackSection() {
    const tech = [
        "NVIDIA Jetson", "PostgreSQL (pgvector)", "Presidio (Edge)",
        "Sentence Transformers", "FastAPI", "Next.js 14", "React", "Docker"
    ];

    return (
        <section className="py-20 border-t border-foreground/5 bg-foreground/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mb-8">Built with Modern Architecture</p>
                <div className="flex flex-wrap justify-center gap-3">
                    {tech.map((item, index) => (
                        <span key={index} className="px-4 py-2 bg-foreground/5 border border-foreground/10 rounded-full text-muted-foreground text-sm font-medium hover:bg-foreground/10 hover:text-foreground transition-colors cursor-default">
                            {item}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}
