export default function Footer() {
    return (
        <footer className="mt-20 py-12 px-6 relative overflow-hidden">
            <div className="max-w-[1600px] mx-auto pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Sovereign Growth Infrastructure</p>
                </div>
                <p className="text-xs font-medium text-slate-500 leading-none">
                    © {new Date().getFullYear()} <span className="text-slate-300">ConvoSpan</span>. Engineering Excellence for Autonomous Teams.
                </p>
            </div>
        </footer>
    );
}
