import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Pricing | ConvoSpan",
    description: "Transparent pricing for high-performance outbound teams. Scale your outreach with AI agents.",
};

export default function PricingLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
