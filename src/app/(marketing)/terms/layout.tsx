import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Terms of Service | ConvoSpan",
    description: "Terms and conditions for using the ConvoSpan platform.",
};

export default function TermsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
