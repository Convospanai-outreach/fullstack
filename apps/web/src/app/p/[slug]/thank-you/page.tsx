import Link from "next/link";

export default function LandingThankYouPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
            <div className="max-w-xl rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center space-y-4">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Thank You</p>
                <h1 className="text-3xl font-bold">We received your request.</h1>
                <p className="text-slate-300">
                    A team member will follow up shortly with next steps.
                </p>
                <Link
                    href="/"
                    className="inline-flex rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                >
                    Back to Home
                </Link>
            </div>
        </div>
    );
}
