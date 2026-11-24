import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/site/kit";

export const metadata: Metadata = {
  title: "Terms & Conditions | CraftMyFunnel",
  description:
    "Read the Terms & Conditions for using CraftMyFunnel, an AI-powered outreach, lead management, workflow automation, and revenue orchestration platform.",
};

const sections = [
  {
    title: "Acceptance of Terms",
    body: [
      "By accessing or using CraftMyFunnel, you confirm that you have read, understood, and agreed to be bound by these Terms & Conditions, along with any policies, product-specific terms, or usage guidelines made available by us.",
      "If you are using CraftMyFunnel on behalf of a company, agency, client, organisation, or other legal entity, you confirm that you have the authority to accept these Terms on its behalf.",
    ],
  },
  {
    title: "About CraftMyFunnel",
    body: [
      "CraftMyFunnel is an AI-powered outreach, lead management, workflow automation, and revenue orchestration platform designed to help MSMEs, founders, agencies, and sales teams manage prospecting, communication, follow-ups, campaign workflows, and related sales operations.",
      "The platform may include features related to email outreach, LinkedIn workflows, WhatsApp communication, lead enrichment, task routing, CRM-style tracking, human-in-the-loop processes, analytics, and third-party integrations.",
    ],
  },
  {
    title: "Eligibility",
    body: [
      "You must be legally capable of entering into a binding agreement under applicable law to use CraftMyFunnel.",
      "You agree not to use the platform if you are prohibited from doing so under applicable laws, regulations, sanctions, or contractual restrictions.",
    ],
  },
  {
    title: "Account Registration",
    body: [
      "To access certain features, you may be required to create an account and provide accurate, complete, and current information.",
      "You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must notify us immediately if you suspect unauthorised access, misuse, or a security breach involving your account.",
    ],
  },
  {
    title: "Use of Services",
    body: [
      "You agree to use CraftMyFunnel only for lawful business purposes.",
      "You are responsible for the content, campaigns, contact lists, messages, automations, prompts, data, and workflows that you create, upload, process, or send through the platform.",
      "You must ensure that your use of CraftMyFunnel complies with all applicable laws, including data protection, privacy, anti-spam, telecommunications, consumer protection, platform-specific, and sector-specific regulations.",
    ],
  },
  {
    title: "Prohibited Activities",
    bullets: [
      "Sending spam, unsolicited bulk messages, or deceptive communications.",
      "Harvesting, scraping, or processing personal data in violation of law.",
      "Impersonation, phishing, fraud, misrepresentation, or illegal solicitation.",
      "Uploading malicious code, malware, or harmful scripts.",
      "Circumventing usage limits, security systems, or access controls.",
      "Violating third-party platform policies, including email, LinkedIn, WhatsApp, CRM, cloud, or API provider policies.",
      "Sending unlawful, defamatory, abusive, discriminatory, misleading, or harmful content.",
      "Interfering with the operation, performance, or security of the platform.",
    ],
    body: ["We reserve the right to suspend or terminate accounts involved in prohibited or suspicious activity."],
  },
  {
    title: "AI and Automation Disclaimer",
    body: [
      "CraftMyFunnel may use artificial intelligence, automation, workflow logic, third-party APIs, or machine-generated recommendations.",
      "AI-generated outputs may be inaccurate, incomplete, outdated, or unsuitable for your specific use case. You are responsible for reviewing, approving, and validating any content, recommendation, message, campaign, lead data, or automation before using it.",
      "CraftMyFunnel does not guarantee any specific business result, lead conversion, revenue outcome, campaign performance, or compliance outcome.",
    ],
  },
  {
    title: "Outreach, Email, LinkedIn and WhatsApp Usage",
    body: [
      "CraftMyFunnel may help users manage outreach across channels such as email, LinkedIn, WhatsApp, and related communication platforms.",
      "You are solely responsible for ensuring that your outreach activities comply with applicable anti-spam and data protection laws, recipient consent requirements, platform-specific terms, message frequency rules, opt-out requirements, and any industry-specific compliance obligations.",
      "CraftMyFunnel is not responsible for account restrictions, deliverability issues, bans, penalties, complaints, or enforcement actions arising from your misuse of third-party communication channels.",
    ],
  },
  {
    title: "Data and Privacy",
    body: [
      "Your use of CraftMyFunnel may involve the processing of business data, contact data, campaign data, communication data, and user account information.",
      "You are responsible for ensuring that you have the required rights, permissions, consent, or lawful basis to upload, process, store, or use any data within the platform.",
      "Our handling of personal data is governed by our Privacy Policy, where applicable. You should not upload sensitive personal data unless necessary, lawful, and properly authorised.",
    ],
  },
  {
    title: "Subscription, Billing and Payments",
    body: [
      "Certain features of CraftMyFunnel may be offered on a paid subscription, usage-based, service-based, or custom commercial model.",
      "By subscribing to a paid plan, you agree to pay all applicable fees, taxes, and charges associated with your selected plan or agreement.",
      "Pricing, features, and billing terms may vary depending on plan, geography, usage, integrations, service level, or custom commercial arrangement. We may update pricing or plan structures from time to time with reasonable notice where required.",
    ],
  },
  {
    title: "Cancellation and Refunds",
    body: [
      "You may cancel your subscription or service as per the cancellation process made available by CraftMyFunnel.",
      "Unless expressly stated in a separate written agreement, payments already made are generally non-refundable. Any refund, credit, or adjustment may be provided at our sole discretion or as required under applicable law.",
      "Cancellation may result in loss of access to paid features, workflows, data exports, integrations, or support services.",
    ],
  },
  {
    title: "Intellectual Property",
    body: [
      "CraftMyFunnel, including its software, design, workflows, branding, interface, content, documentation, product architecture, and related intellectual property, is owned by or licensed to CraftMyFunnel.",
      "You may not copy, modify, reverse engineer, resell, reproduce, distribute, sublicense, or create derivative works from the platform without prior written permission.",
      "You retain ownership of your own business data, campaign content, and uploaded materials, subject to the rights required for us to provide the services.",
    ],
  },
  {
    title: "Third-Party Integrations",
    body: [
      "CraftMyFunnel may integrate with third-party platforms, APIs, tools, CRMs, communication services, email providers, cloud services, LinkedIn, WhatsApp, Google services, or other external systems.",
      "Your use of third-party integrations is subject to the terms, policies, and limitations of those third-party providers.",
      "We are not responsible for outages, policy changes, pricing changes, data issues, account restrictions, or functionality changes caused by third-party services.",
    ],
  },
  {
    title: "Service Availability",
    body: [
      "We aim to provide reliable access to CraftMyFunnel, but we do not guarantee uninterrupted, error-free, or always-available service.",
      "The platform may be unavailable due to maintenance, updates, security issues, technical failures, hosting issues, third-party outages, or events beyond our control.",
      "We may modify, improve, suspend, or discontinue parts of the platform at any time.",
    ],
  },
  {
    title: "Limitation of Liability",
    body: [
      "To the maximum extent permitted by applicable law, CraftMyFunnel shall not be liable for indirect, incidental, special, consequential, or punitive damages, including loss of profits, revenue, data, goodwill, business opportunity, or campaign performance.",
      "Your use of the platform is at your own risk. Our total liability, if any, shall be limited to the amount paid by you to CraftMyFunnel for the relevant service during the period giving rise to the claim, unless otherwise required by law.",
    ],
  },
  {
    title: "Indemnity",
    body: [
      "You agree to indemnify and hold CraftMyFunnel, its founders, team members, partners, service providers, and affiliates harmless from any claims, damages, losses, liabilities, costs, or expenses arising from your use or misuse of the platform, violation of these Terms, violation of applicable laws or third-party rights, outreach activity, data usage, automations, communications, or breach of third-party platform terms.",
    ],
  },
  {
    title: "Termination",
    body: [
      "We may suspend or terminate your access to CraftMyFunnel if we believe that you have violated these Terms, misused the platform, created legal or security risk, failed to pay applicable fees, or engaged in harmful activity.",
      "You may stop using the platform at any time. After termination, your access to certain data, features, workflows, or services may be restricted or removed.",
    ],
  },
  {
    title: "Changes to Terms",
    body: [
      "We may update these Terms & Conditions from time to time.",
      "When we make material changes, we may notify users through the website, platform, email, or other reasonable means. Your continued use of CraftMyFunnel after changes become effective means you accept the updated Terms.",
    ],
  },
  {
    title: "Governing Law",
    body: [
      "These Terms shall be governed by and interpreted in accordance with the laws of India.",
      "Any disputes shall be subject to the jurisdiction of competent courts in India, unless otherwise specified in a separate written agreement.",
    ],
  },
  {
    title: "Contact Information",
    body: [
      "For questions regarding these Terms & Conditions, please contact CraftMyFunnel at contact.us@craftmyfunnel.live.",
    ],
  },
];

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function TermsPage() {
  return (
    <ProsePage eyebrow="Legal" title="Terms & Conditions" updated="09 June 2026">
      <p>These Terms govern your access to and use of CraftMyFunnel, including our website, platform, tools, applications, workflows, automations, integrations, and related services.</p>
      <p><strong>Disclaimer:</strong> This document is provided for general business use and does not constitute legal advice. You should consult a qualified legal professional before relying on it for compliance or contractual purposes.</p>
      <h2>On this page</h2>
      <ol>{sections.map((section) => <li key={section.title}><a href={`#${slugify(section.title)}`}>{section.title}</a></li>)}</ol>
      {sections.map((section, index) => (
        <section key={section.title} id={slugify(section.title)} style={{ scrollMarginTop: 96 }}>
          <h2>{index + 1}. {section.title}</h2>
          {section.body?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}
        </section>
      ))}
      <p>Contact: <a href="mailto:contact.us@craftmyfunnel.live">contact.us@craftmyfunnel.live</a></p>
    </ProsePage>
  );
}
