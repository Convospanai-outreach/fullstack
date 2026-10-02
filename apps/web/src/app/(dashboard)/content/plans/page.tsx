"use client";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { LaunchPlans } from "@/components/content/LaunchPlans";

export default function LaunchPlansPage() {
    return (
        <div className="space-y-6">
            <SectionHeader title="Launch plans" subtitle="Describe your launch once and get 4 weeks of draft posts to review." />
            <LaunchPlans />
        </div>
    );
}
