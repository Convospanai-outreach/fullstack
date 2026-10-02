"use client";

import { SectionHeader } from "@/components/ui/SectionHeader";
import { ContentRoi } from "@/components/content/ContentRoi";

export default function ContentRoiPage() {
    return (
        <div className="space-y-6">
            <SectionHeader title="Content ROI" subtitle="Which posts bring visits, sign-ups and sales." />
            <ContentRoi />
        </div>
    );
}
