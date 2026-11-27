import { ProsePage } from "@/components/marketing/site/kit";
export const metadata = {
  title: "Google API Disclosure | CraftMyFunnel",
  description: "CraftMyFunnel's use of Google API Services and Limited Use policy compliance.",
  alternates: { canonical: "/google-api-disclosure" },
};

export default function GoogleApiDisclosurePage() {
  return (
    <ProsePage eyebrow="Trust" title="Google API Disclosure" updated="August 11, 2026">
          <p>CraftMyFunnel uses Google APIs only to provide user-requested product functionality.</p>
          <p>CraftMyFunnel uses Gmail API access to (1) send user-approved outreach emails from the connected mailbox, and (2) read limited mailbox data — message headers such as thread ID, In-Reply-To, and References — solely to detect replies to sent campaign emails, so reply status can be shown in the product. Gmail message content outside of this reply-matching purpose is not read, stored, or processed.</p>
          <p>CraftMyFunnel does not sell Google user data, does not use Google user data for advertising, and does not transfer Google user data to third parties except as necessary to provide or improve user-facing features, comply with law, or protect the service.</p>
          <p>CraftMyFunnel’s use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.</p>
          <p>Users may disconnect Google integrations from the application setup page where available or contact <a href="mailto:contact.us@craftmyfunnel.live">contact.us@craftmyfunnel.live</a> for assistance.</p>
        </ProsePage>
  );
}
