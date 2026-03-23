import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign In | ConvoSpan",
    description: "Sign in to your ConvoSpan account to manage your AI agents and growth workflows.",
};

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
