import { ProsePage } from "@/components/marketing/site/kit";

export const metadata = {
  title: "Security | CraftMyFunnel",
  description: "How CraftMyFunnel protects connected accounts, credentials, and application data.",
  alternates: { canonical: "/security" },
};

export default function SecurityPage() {
  return (
    <ProsePage eyebrow="Trust" title="Security" updated="May 25, 2026">
          <p>CraftMyFunnel uses authentication controls, role-based and team-based access checks, encrypted secret storage where applicable, and operational safeguards to protect connected accounts and application data.</p>
          <p>Connected integrations should use least-privilege OAuth scopes. For Gmail send-only mailbox connection, the application should request only the access needed to send user-approved emails.</p>
          <p>OAuth tokens, refresh tokens, SMTP passwords, and credentials should not be exposed in frontend code, public logs, analytics tools, or support screenshots.</p>
          <p>Users should only connect Google Workspace accounts, Gmail mailboxes, domains, and sender identities they own or are authorized to use.</p>
          <p>To report a security concern, contact <a href="mailto:contact.us@craftmyfunnel.live">contact.us@craftmyfunnel.live</a>.</p>
        </ProsePage>
  );
}
