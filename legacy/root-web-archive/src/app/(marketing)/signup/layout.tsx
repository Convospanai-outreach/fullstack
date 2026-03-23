import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Create Account | ConvoSpan",
    description: "Start your 14-day free trial. Unleash a sovereign AI agent army to scale your growth velocity.",
};

export default function SignupLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
