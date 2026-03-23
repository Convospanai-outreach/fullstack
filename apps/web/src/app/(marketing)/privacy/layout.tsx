import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Privacy Policy | ConvoSpan",
    description: "Our commitment to data sovereignty and your privacy.",
};

export default function PrivacyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
