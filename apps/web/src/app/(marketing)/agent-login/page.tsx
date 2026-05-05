import { RoleLoginPage } from "@/components/auth/RoleLoginPage";

export default function AgentLoginPage() {
    return (
        <RoleLoginPage
            title="Agent login"
            subtitle="Access campaign operations, reviews, leads, follow-ups, and launch readiness."
            emailLabel="Agent work email"
            callbackUrl="/dashboard"
            accent="violet"
        />
    );
}
