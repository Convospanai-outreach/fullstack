
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

                <h3 className="text-xl font-semibold text-white">5. Google Workspace APIs (OAuth)</h3>
                <p>Our application uses Google Workspace APIs (like Gmail) to enable email campaigns. Our use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-400 hover:underline" target="_blank" rel="noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
                <p>We only access the email data necessary to provide our outreach tracking and automated campaign services. We do not use your Google data for targeted advertising, nor do we allow humans to read your data unless you explicitly consent or for security purposes.</p>
            </GlassCard>
        </div>
    );
}
