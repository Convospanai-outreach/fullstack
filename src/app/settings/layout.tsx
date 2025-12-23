import Link from "next/link";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-gray-900 text-white">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/10 p-6 space-y-2">
                <h2 className="text-xl font-bold mb-6 px-2">Settings</h2>

                <NavLink href="/settings/general">General</NavLink>
                <NavLink href="/settings/notifications">Notifications</NavLink>
                <NavLink href="/settings/keys">API Keys</NavLink>
                <NavLink href="/settings/agent">AI Agent</NavLink>
                <NavLink href="/settings/webhooks">Webhooks</NavLink>
                <NavLink href="/docs/api">Documentation</NavLink>
                <NavLink href="/settings/billing">Billing</NavLink>
                <NavLink href="/settings/team">Team Members</NavLink>
                <NavLink href="/settings/guardrails">AI Guardrails</NavLink>
                <NavLink href="/settings/audit">Audit Logs</NavLink>
                <NavLink href="/settings/branding">Branding</NavLink>
            </aside>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}

function NavLink({ href, children }: { href: string, children: React.ReactNode }) {
    // Basic link component. In a real app we'd use usePathname for active state
    return (
        <Link href={href} className="block px-4 py-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-colors">
            {children}
        </Link>
    );
}
