import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contact Sales & Engineering Support | CraftMyFunnel",
    description: "Get in touch with the CraftMyFunnel team for B2B outbound consultations, custom vertical playbooks, enterprise integrations, and platform support.",
    alternates: {
        canonical: "https://craftmyfunnel.live/contact",
    },
    openGraph: {
        title: "Contact CraftMyFunnel | B2B Outbound Platform Support",
        description: "Speak with our engineering and revenue operations team regarding pilot onboarding, custom integrations, or platform SLAs.",
        url: "https://craftmyfunnel.live/contact",
        images: [
            {
                url: "/images/platform/contact-support.webp",
                width: 820,
                height: 460,
                alt: "CraftMyFunnel Enterprise Support Desk",
            }
        ],
    },
};

const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "name": "Contact CraftMyFunnel",
    "description": "Connect with CraftMyFunnel for outbound operations consultation and enterprise support.",
    "url": "https://craftmyfunnel.live/contact",
    "mainEntity": {
        "@type": "Organization",
        "name": "CraftMyFunnel",
        "url": "https://craftmyfunnel.live",
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer support",
            "email": "support@craftmyfunnel.live",
            "availableLanguage": ["English", "Hindi"]
        }
    }
};

export default function ContactLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
            />
            {children}
        </>
    );
}

