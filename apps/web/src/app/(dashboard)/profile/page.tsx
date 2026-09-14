"use client";

import { useSession } from "next-auth/react";
import SectionTitle from "../../../components/SectionTitle";
import GlassCard from "../../../components/GlassCard";

export default function ProfilePage() {
    const { data: session, status } = useSession();
    const isLoaded = status !== "loading";
    const name = session?.user?.name || session?.user?.email?.split("@")[0] || "—";
    const email = session?.user?.email || "—";

    return (
        <div className="section max-w-3xl">
            <SectionTitle title="Your Profile" />
            <GlassCard title="User Settings">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-muted-foreground">Name</label>
                        <div className="text-foreground">{isLoaded ? name : "Loading..."}</div>
                    </div>
                    <div>
                        <label className="block text-sm text-muted-foreground">Email</label>
                        <div className="text-foreground">{isLoaded ? email : "Loading..."}</div>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
