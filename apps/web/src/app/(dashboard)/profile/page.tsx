"use client";

import { useUser } from "@clerk/nextjs";
import SectionTitle from "../../../components/SectionTitle";
import GlassCard from "../../../components/GlassCard";

export default function ProfilePage() {
    const { user, isLoaded } = useUser();
    const name = user?.fullName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "—";
    const email = user?.primaryEmailAddress?.emailAddress || "—";

    return (
        <div className="section max-w-3xl">
            <SectionTitle title="Your Profile" />
            <GlassCard title="User Settings">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-400">Name</label>
                        <div className="text-white">{isLoaded ? name : "Loading..."}</div>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400">Email</label>
                        <div className="text-white">{isLoaded ? email : "Loading..."}</div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
