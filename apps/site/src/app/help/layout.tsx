export const metadata = {
    title: "Help Center | CraftMyFunnel",
    description: "Find answers and support articles for CraftMyFunnel.",
    alternates: { canonical: "/help" },
};

export default function HelpLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
