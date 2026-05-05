import { RoleLoginPage } from "@/components/auth/RoleLoginPage";

export default function ClientLoginPage() {
    return (
        <RoleLoginPage
            title="Client login"
            subtitle="View campaign progress, outreach activity, lead review status, and meeting workflow tracking."
            emailLabel="Client email"
            callbackUrl="/client"
            accent="cyan"
        />
    );
}
