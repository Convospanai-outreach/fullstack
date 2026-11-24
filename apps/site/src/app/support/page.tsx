import { ProsePage } from "@/components/marketing/site/kit";

export const metadata = {
  title: "Support | CraftMyFunnel",
  description: "Get help with Google Workspace setup, Gmail OAuth, domain readiness, billing, and technical issues.",
};

export default function SupportPage() {
  return (
    <ProsePage eyebrow="Support" title="How can we help?">
      <p>CraftMyFunnel support can help with Google Workspace setup, Gmail OAuth connection, domain readiness checks (SPF, DKIM, DMARC, MX), account access, billing and technical issues.</p>
      <p>Email: <a href="mailto:contact.us@craftmyfunnel.live">contact.us@craftmyfunnel.live</a></p>
      <p>Include your workspace name, account email, issue details and screenshots where relevant. For guides, see the <a href="/help">Help Center</a>.</p>
    </ProsePage>
  );
}
