import SectionTitle from "../../components/SectionTitle";
import GlassCard from "../../components/GlassCard";

export default function ProfilePage() {
    return (
        <div className="section max-w-3xl">
            <SectionTitle title="Your Profile" />
            <GlassCard title="User Settings">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400">Name</label>
                        <div className="text-white">John Doe</div>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400">Email</label>
                        <div className="text-white">john@example.com</div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
