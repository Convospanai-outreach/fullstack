import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";

export default function TermsPage() {
    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            <SectionHeader title="Terms of Service" subtitle="Last updated: December 2025" />
            <GlassCard className="space-y-4 text-gray-300">
                <h3 className="text-xl font-semibold text-white">1. Acceptance of Terms</h3>
                <p>By accessing and using CraftMyFunnel, you accept and agree to be bound by the terms and provision of this agreement.</p>

                <h3 className="text-xl font-semibold text-white">2. Use License</h3>
                <p>Permission is granted to temporarily download one copy of the materials (information or software) on CraftMyFunnel's website for personal, non-commercial transitory viewing only.</p>

                <h3 className="text-xl font-semibold text-white">3. Disclaimer</h3>
                <p>The materials on CraftMyFunnel's website are provided on an 'as is' basis. CraftMyFunnel makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>

                <h3 className="text-xl font-semibold text-white">4. Limitations</h3>
                <p>In no event shall CraftMyFunnel or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on CraftMyFunnel's website.</p>

                <h3 className="text-xl font-semibold text-white">5. Third-Party Account Connections</h3>
                <p>By connecting a third-party account such as Google to your CraftMyFunnel account, you grant us permission to access and use your data in accordance with our Privacy Policy to provide you the core service. You are responsible for ensuring that you have the right to connect these accounts and that you abide by their respective terms of service.</p>
            </GlassCard>
        </div>
    );
}
