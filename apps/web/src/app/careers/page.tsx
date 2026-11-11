import Link from "next/link";
import type { Metadata } from "next";
import { getJobs } from "@/lib/careers";

export const metadata: Metadata = {
    title: "Careers | CraftMyFunnel",
    description: "Open positions at CraftMyFunnel.",
    alternates: { canonical: "https://craftmyfunnel.live/careers" },
};

export default function CareersPage() {
    const jobs = getJobs();

    return (
        <div className="container mx-auto max-w-3xl px-4 pt-6 pb-16">
            <h1 className="text-4xl font-extrabold tracking-tight mb-4">Careers</h1>
            <p className="text-lg text-muted-foreground mb-10">Join the team building governed AI outreach.</p>
            {jobs.length === 0 ? (
                <p className="rounded-xl border bg-card p-6 text-muted-foreground">There are no open positions right now. Please check back soon.</p>
            ) : (
                <ul className="space-y-4">
                    {jobs.map((job) => (
                        <li key={job.slug}>
                            <Link href={`/careers/${encodeURIComponent(job.slug)}`} className="block rounded-xl border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg">
                                <h2 className="text-xl font-bold">{job.title}</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {[job.department, job.location, job.type].filter(Boolean).join(" · ")}
                                </p>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
