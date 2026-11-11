import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { ApplyForm } from "@/components/careers/ApplyForm";
import { getJobBySlug } from "@/lib/careers";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const job = getJobBySlug((await params).slug);
    return job
        ? { title: `${job.title} | Careers | CraftMyFunnel`, alternates: { canonical: `https://craftmyfunnel.live/careers/${job.slug}` } }
        : { title: "Careers | CraftMyFunnel" };
}

export default async function JobPage({ params }: Props) {
    const job = getJobBySlug((await params).slug);
    if (!job) notFound();

    return (
        <div className="container mx-auto max-w-3xl px-4 pt-6 pb-16">
            <Link href="/careers" className="text-sm text-muted-foreground hover:underline">
                All openings
            </Link>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{job.title}</h1>
            <p className="mt-2 text-muted-foreground">{[job.department, job.location, job.type].filter(Boolean).join(" · ")}</p>
            <div className="prose prose-invert mt-8 max-w-none">
                <ReactMarkdown>{job.description}</ReactMarkdown>
            </div>
            <h2 className="mt-12 mb-4 text-2xl font-bold">Apply</h2>
            <ApplyForm jobSlug={job.slug} />
        </div>
    );
}
