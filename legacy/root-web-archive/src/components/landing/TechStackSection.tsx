

export default function TechStackSection() {
    const tech = [
        "NVIDIA Jetson", "PostgreSQL (pgvector)", "Presidio (Edge)",
        "Sentence Transformers", "FastAPI", "Next.js 14", "React", "Docker"
    ];

    return (
        <section className="py-20 border-t border-white/5 bg-black/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold mb-8">Built with Modern Architecture</p>
                <div className="flex flex-wrap justify-center gap-3">
                    {tech.map((item, index) => (
                        <span key={index} className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-gray-400 text-sm font-medium hover:bg-white/10 hover:text-white transition-colors cursor-default">
                            {item}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}
