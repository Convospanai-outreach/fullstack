"use client";

import { use } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LaunchPlanReview } from "@/components/content/LaunchPlanReview";

export default function LaunchPlanPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    return (
        <div className="space-y-6">
            <Link href="/content/plans" className="text-sm text-primary hover:underline">&larr; All launch plans</Link>
            <SectionHeader title="Launch plan" subtitle="Everything this plan drafted. Nothing is posted until it's approved." />
            <LaunchPlanReview id={id} />
        </div>
    );
}
