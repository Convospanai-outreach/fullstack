import Link from "next/link";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-surface-app text-foreground">
            {/* Sidebar */}
            <aside className="w-64 border-r border-border p-6 space-y-2 bg-surface-panel">
                <h2 className="text-xl font-bold mb-6 px-2">Settings</h2>

                <NavLink href="/settings/general">General</NavLink>
                <NavLink href="/settings/mailboxes">Connected Mailboxes</NavLink>
                <NavLink href="/settings/notifications">Notifications</NavLink>
                <NavLink href="/settings/keys">API Keys</NavLink>
                <NavLink href="/settings/agent">AI Agent</NavLink>
                <NavLink href="/settings/webhooks">Webhooks</NavLink>
                <NavLink href="/settings/features">Features</NavLink>
                <NavLink href="/docs/api">Documentation</NavLink>
                <NavLink href="/settings/budgeting">Billing</NavLink>
                <NavLink href="/settings/team">Team Members</NavLink>
                <NavLink href="/settings/guardrails">AI Guardrails</NavLink>
                <NavLink href="/settings/governance">Enterprise Governance</NavLink>
                <NavLink href="/settings/approvals">Approval Inbox</NavLink>
                <NavLink href="/settings/audit">Audit Logs</NavLink>
                <NavLink href="/settings/branding">Branding</NavLink>
            </aside>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}

function NavLink({ href, children }: { href: string, children: React.ReactNode }) {
    // Basic link component. In a real app we'd use usePathname for active state
    return (
        <Link href={href} className="block px-4 py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors font-medium text-sm">
            {children}
        </Link>
    );
}
