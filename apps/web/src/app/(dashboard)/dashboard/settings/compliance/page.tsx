import { SectionHeader } from '@/components/ui/SectionHeader';
import ComplianceSettings from '@/components/settings/ComplianceSettings';

export default function CompliancePage() {
    return (
        <div className="container mx-auto py-8">
            <SectionHeader title="Compliance & Sovereignty" />
            <ComplianceSettings />
        </div>
    );
}
