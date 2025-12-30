
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";

export default function PrivacyPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <SectionHeader title="Privacy Policy" subtitle="Last updated: December 2025" />
            <GlassCard className="space-y-4 text-gray-300">
                <h3 className="text-xl font-semibold text-white">1. Information Collection</h3>
                <p>We collect information from you when you register on our site, subscribe to our newsletter, respond to a survey or fill out a form.</p>

                <h3 className="text-xl font-semibold text-white">2. Use of Information</h3>
                <p>Any of the information we collect from you may be used in one of the following ways: to personalize your experience, to improve our website, to improve customer service, to process transactions, to send periodic emails.</p>

                <h3 className="text-xl font-semibold text-white">3. Information Protection</h3>
                <p>We implement a variety of security measures to maintain the safety of your personal information when you enter, submit, or access your personal information.</p>

                <h3 className="text-xl font-semibold text-white">4. Cookies</h3>
                <p>We use cookies to understand and save your preferences for future visits and compile aggregate data about site traffic and site interaction so that we can offer better site experiences and tools in the future.</p>
            </GlassCard>
        </div>
    );
}
