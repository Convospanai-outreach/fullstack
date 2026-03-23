import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Forgot Password | ConvoSpan",
    description: "Reset your ConvoSpan account password.",
};

export default function ForgotPasswordLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
