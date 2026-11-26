import { ProsePage } from "@/components/marketing/site/kit";
export const metadata = {
  title: "Data Deletion Request | CraftMyFunnel",
  description: "How to request deletion of your data from CraftMyFunnel.",
  alternates: { canonical: "/data-deletion" },
};

export default function DataDeletionPage() {
  return (
    <ProsePage eyebrow="Privacy" title="Data Deletion Request" updated="May 25, 2026">
          <p>Users may request deletion of account data, workspace data, campaign data, uploaded lead data, connected integration data, mailbox information, Google OAuth tokens where applicable, and data captured by the CraftMyFunnel Chrome extension (LinkedIn profile details, notes, and qualification fields, whether stored locally or synced to a workspace).</p>
          <p>To request deletion, email <a href="mailto:contact.us@craftmyfunnel.live">contact.us@craftmyfunnel.live</a> with your account email, workspace name, and deletion request.</p>
          <p>Users may also disconnect Google mailboxes from the application setup page where available.</p>
          <p>When a Google integration is disconnected or deletion is requested, Google access tokens and refresh tokens should be revoked or removed from CraftMyFunnel systems where applicable.</p>
        </ProsePage>
  );
}
