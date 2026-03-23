export default function Loading() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
            <div className="glass-card p-8 rounded-2xl flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin" />
                    <div className="absolute inset-2 rounded-full border-t-2 border-r-2 border-purple-500 animate-spin reverse" style={{ animationDirection: 'reverse', animationDuration: '1s' }} />
                </div>
                <p className="text-gray-300 font-medium animate-pulse">Loading ConvoSpan...</p>
            </div>
        </div>
    );
}
