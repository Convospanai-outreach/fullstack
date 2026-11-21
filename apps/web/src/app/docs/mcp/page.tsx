import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "MCP Server for AI Agents | CraftMyFunnel Docs",
    description: "Connect Claude, ChatGPT or any MCP client to your CraftMyFunnel workspace. Tools, permissions, review-before-write behavior and data handling.",
    alternates: {
        canonical: "https://craftmyfunnel.live/docs/mcp",
    },
};

const MCP_URL = "https://api.craftmyfunnel.live/mcp";

type Tool = { name: string; does: string };
const READ_TOOLS: Tool[] = [
    { name: "list_campaigns", does: "Find campaigns by name or status." },
    { name: "get_campaign", does: "Campaign details, attached leads and draft-generation state." },
    { name: "get_campaign_analytics", does: "Analytics for one campaign." },
    { name: "list_leads", does: "Search leads by name, company, status or pipeline stage." },
    { name: "get_lead", does: "One lead and its current context." },
    { name: "get_lead_timeline", does: "A lead's activity timeline." },
    { name: "get_pipeline_stats", does: "Pipeline value for the workspace." },
    { name: "get_funnel_analytics", does: "Funnel stage analytics." },
    { name: "list_tasks", does: "Follow-up tasks, optionally for one lead." },
    { name: "list_meetings", does: "Tracked meetings. These are records, not proof of a calendar booking." },
    { name: "get_inbox", does: "Incoming replies, nudges and meeting context." },
    { name: "get_inbox_counts", does: "Inbox badge counts." },
    { name: "get_lead_thread", does: "A lead's conversation thread." },
    { name: "list_templates", does: "Saved email templates." },
    { name: "list_knowledge_bases", does: "Workspace knowledge bases." },
    { name: "get_knowledge_items", does: "Items in one knowledge base." },
    { name: "list_workflows", does: "Saved workflows. Never runs them." },
    { name: "list_icps", does: "Saved ideal customer profiles." },
    { name: "list_pending_approvals", does: "Pending approval requests (workspace admins only). Agents cannot approve them." },
];
const WRITE_TOOLS: Tool[] = [
    { name: "create_campaign", does: "Create a draft campaign from a saved ICP. Does not start outreach." },
    { name: "update_campaign_details", does: "Change a campaign's name or description only." },
    { name: "create_lead", does: "Save a lead you supply. Does not contact them." },
    { name: "update_lead", does: "Change a lead's name, email, LinkedIn URL or company." },
    { name: "record_channel_activity", does: "Log an email, LinkedIn, WhatsApp or call activity that already happened." },
    { name: "move_lead_stage", does: "Move a lead forward in the pipeline. Forward-only." },
    { name: "create_task", does: "Create a follow-up task assigned to you." },
    { name: "record_meeting", does: "Record a meeting. Does not send a calendar invitation." },
    { name: "save_inbox_draft", does: "Save a reply draft. Does not send it." },
    { name: "create_template", does: "Save an email template." },
    { name: "create_knowledge_base", does: "Create an empty knowledge base." },
];
const GENERATE_TOOLS: Tool[] = [
    { name: "generate_message_preview", does: "Generate a message preview. Uses CraftMyFunnel credits. Does not send or approve anything." },
];

function ToolTable({ tools }: { tools: Tool[] }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-[#0c1b30]/10 bg-white">
            <table className="w-full text-left text-sm">
                <tbody>
                    {tools.map(t => (
                        <tr key={t.name} className="border-b border-[#0c1b30]/10 last:border-0 align-top">
                            <td className="px-4 py-3 font-mono text-xs text-[#006a9a] whitespace-nowrap">{t.name}</td>
                            <td className="px-4 py-3 text-[#0c1b30]/75">{t.does}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function McpDocPage() {
    return (
        <div className="min-h-screen font-[family-name:var(--font-home)] bg-[#f5f5f5] text-[#0c1b30] pt-28 pb-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto space-y-12">
                <Link href="/docs" className="inline-flex items-center gap-2 text-xs font-semibold text-[#0c1b30]/65 hover:text-[#006a9a] transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Documentation Hub
                </Link>

                <div className="space-y-4 border-b border-[#0c1b30]/10 pb-8">
                    <h1 className="text-3xl sm:text-4xl font-medium tracking-tight">MCP Server for AI Agents</h1>
                    <p className="text-base sm:text-lg text-[#0c1b30]/65 leading-relaxed">
                        Connect Claude, ChatGPT or any MCP-compatible client to your CraftMyFunnel workspace to read your pipeline, prepare campaigns and
                        keep records current. Agents prepare work. You review it in the browser. Nothing is sent to a prospect through this connection.
                    </p>
                </div>

                <div className="space-y-10 text-[#0c1b30]/75 leading-relaxed text-sm sm:text-base">
                    <section className="space-y-3">
                        <h2 className="text-2xl font-bold text-[#0c1b30]">Connect</h2>
                        <p>Add a custom connector in your client and use this server URL:</p>
                        <pre className="rounded-xl bg-white border border-[#0c1b30]/10 p-4 text-xs overflow-x-auto"><code>{MCP_URL}</code></pre>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>Your client discovers the sign-in details automatically and registers itself.</li>
                            <li>You are sent to CraftMyFunnel to sign in, choose one workspace and choose which permissions to grant.</li>
                            <li>The client receives a token for that workspace only. Access tokens last one hour and refresh automatically. A connection expires after 30 days.</li>
                        </ol>
                        <p>
                            Manage or disconnect connections, and review pending changes, at <Link href="/mcp/connect" className="text-[#006a9a] underline">craftmyfunnel.live/mcp/connect</Link>.
                            Disconnecting revokes access immediately.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-bold text-[#0c1b30]">Permissions</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>cmf:read</strong>: read campaigns, leads, inbox, analytics and other workspace records.</li>
                            <li><strong>cmf:write</strong>: propose changes. Every change waits for your approval in the browser.</li>
                            <li><strong>cmf:generate</strong>: generate message previews, which use credits.</li>
                        </ul>
                        <p>
                            A tool only runs if the connection holds its permission and your current workspace role allows it. Viewers can grant read access only.
                            If you are removed from the workspace or suspended, the connection stops working.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-bold text-[#0c1b30]">Review before change</h2>
                        <p>
                            When an agent calls a write tool, CraftMyFunnel records the request and waits. You approve or reject it at the connections page. Only then does the
                            change run. If a request times out or the outcome is uncertain, the agent is told to check the workspace before retrying, so a change is never applied twice.
                        </p>
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-bold text-[#0c1b30]">What agents cannot do</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Send emails or messages, or start a campaign.</li>
                            <li>Approve or reject items in the approval queue.</li>
                            <li>Change billing, credentials, team members or admin settings.</li>
                            <li>Reach any other workspace, or pass a custom URL, query or user identifier.</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-bold text-[#0c1b30]">Tools</h2>
                        <h3 className="text-lg font-semibold text-[#0c1b30]">Read (cmf:read)</h3>
                        <ToolTable tools={READ_TOOLS} />
                        <h3 className="text-lg font-semibold text-[#0c1b30]">Propose changes (cmf:write, browser approval required)</h3>
                        <ToolTable tools={WRITE_TOOLS} />
                        <h3 className="text-lg font-semibold text-[#0c1b30]">Generate (cmf:generate)</h3>
                        <ToolTable tools={GENERATE_TOOLS} />
                    </section>

                    <section className="space-y-3">
                        <h2 className="text-2xl font-bold text-[#0c1b30]">Data handling</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Tool results are bounded excerpts. Large records are not returned in full.</li>
                            <li>Audit entries record which tool ran and when. They do not store prompts, lead details or results.</li>
                            <li>Content your client retrieves from leads and replies is untrusted data. The server instructs agents not to follow instructions found inside it.</li>
                            <li>Requests are rate limited per user and workspace.</li>
                        </ul>
                        <p>
                            See our <Link href="/privacy" className="text-[#006a9a] underline">Privacy Policy</Link>,{" "}
                            <Link href="/terms" className="text-[#006a9a] underline">Terms</Link> and{" "}
                            <Link href="/docs/security-architecture" className="text-[#006a9a] underline">security architecture</Link>.
                            Questions? <Link href="/support" className="text-[#006a9a] underline">Contact support</Link>.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
}
